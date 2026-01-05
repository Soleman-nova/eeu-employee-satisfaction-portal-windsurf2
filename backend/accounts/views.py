from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.contrib.auth import authenticate, get_user_model
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework.permissions import IsAuthenticated, BasePermission
from django.db.models import Avg, Q, Count
from django.utils import timezone
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from django.utils.html import strip_tags

from surveys.models import Survey, Section, Question, Response as SurveyResponse, Answer
from utils.export_utils import export_responses_to_excel, export_responses_to_pdf
from drf_spectacular.utils import extend_schema, OpenApiParameter, OpenApiTypes, OpenApiResponse


User = get_user_model()


def _get_user_role(user) -> str:
    """Normalize the role used across the admin portal."""
    raw_role = getattr(user, "role", None)
    if raw_role in ("super_admin", "survey_designer", "viewer"):
        return raw_role
    if getattr(user, "is_superuser", False):
        return "super_admin"
    if getattr(user, "is_staff", False):
        return "survey_designer"
    return "viewer"


class IsSuperAdmin(BasePermission):
    def has_permission(self, request, view) -> bool:
        user = request.user
        if not user or not user.is_authenticated:
            return False
        return _get_user_role(user) == "super_admin"


class AdminLoginView(APIView):
    authentication_classes = []
    permission_classes = []

    @extend_schema(
        tags=["Admin Auth"],
        description="Admin login returning JWT access (and refresh) tokens.",
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        if not username or not password:
            return Response({"detail": "Username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username, password=password)
        if user is None:
            return Response({"detail": "Invalid credentials"}, status=status.HTTP_401_UNAUTHORIZED)

        # Allow all three admin portal roles to log in: super_admin, survey_designer, viewer.
        # We normalise the role for the frontend using the helper above.
        role = _get_user_role(user)

        refresh = RefreshToken.for_user(user)
        full_name = getattr(user, "get_full_name", lambda: "")() or user.username

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "full_name": full_name,
                    "role": role,
                },
            },
            status=status.HTTP_200_OK,
        )


class DashboardView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Admin Dashboard"],
        description="Aggregated dashboard data for the active survey: totals, averages, timeseries, and distributions.",
    )
    def get(self, request):
        survey_id = request.query_params.get("survey")
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        survey = None
        if survey_id:
            try:
                survey = Survey.objects.filter(id=int(survey_id)).first()
            except (TypeError, ValueError):
                survey = None
        if not survey:
            survey = (
                Survey.objects.filter(is_active=True)
                .order_by("-created_at")
                .first()
            )
        if not survey:
            return Response({
                "survey": None,
                "totals": {"responses": 0},
                "averages": [],
                "recent": [],
                "timeseries": [],
                "distributions": {},
            })

        region = request.query_params.get("region")

        base_responses_qs = SurveyResponse.objects.filter(survey=survey)
        # Date filters (inclusive)
        if date_from:
            d = parse_date(date_from)
            if d:
                base_responses_qs = base_responses_qs.filter(submitted_at__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                base_responses_qs = base_responses_qs.filter(submitted_at__date__lte=d)
        if region:
            # Filter responses by selected region based on the Regions question answer.
            base_responses_qs = base_responses_qs.filter(
                answers__question__question_type="regions",
                answers__choice=region,
            ).distinct()

        total_responses = base_responses_qs.count()

        # Average rating per rating-type question
        averages = []
        for q in Question.objects.filter(survey=survey, question_type="rating"):
            avg = Answer.objects.filter(
                response__in=base_responses_qs,
                question=q,
                rating__isnull=False,
            ).aggregate(v=Avg("rating"))["v"]
            averages.append({
                "question_id": q.id,
                "question": q.text,
                "avg_rating": round(float(avg), 2) if avg is not None else None,
            })

        recent_qs = (
            base_responses_qs
            .order_by("-submitted_at")
            .values("id", "submitted_at")[:10]
        )
        recent = list(recent_qs)

        # Responses per day (last 14 days)
        today = timezone.now().date()
        start_date = today - timezone.timedelta(days=13)
        ts_counts = (
            base_responses_qs
            .filter(submitted_at__date__gte=start_date, submitted_at__date__lte=today)
            .extra({'day': "date(submitted_at)"})
            .values('day')
            .annotate(c=Count('id', distinct=True))
        )
        ts_map = {str(r['day']): r['c'] for r in ts_counts}
        timeseries = []
        for i in range(14):
            d = start_date + timezone.timedelta(days=i)
            timeseries.append({"date": d.isoformat(), "count": int(ts_map.get(str(d), 0))})

        # Distribution per rating question (counts for 1..5)
        distributions = {}
        for q in Question.objects.filter(survey=survey, question_type="rating"):
            counts = {r: 0 for r in range(1, 6)}
            agg = (
                Answer.objects.filter(
                    response__in=base_responses_qs,
                    question=q,
                    rating__isnull=False,
                )
                .values('rating')
                .annotate(c=Count('id'))
            )
            for row in agg:
                r = int(row['rating'])
                if 1 <= r <= 5:
                    counts[r] = row['c']
            distributions[str(q.id)] = counts

        def _pct(part: int, total: int) -> float:
            if total <= 0:
                return 0.0
            return round((float(part) / float(total)) * 100.0, 1)

        def _pct_breakdown_1dp_sum100(counts):
            total = int(sum(int(counts.get(r, 0) or 0) for r in range(1, 6)))
            target_tenths = 1000
            perc_tenths = {r: 0 for r in range(1, 6)}
            if total > 0:
                raw = []
                used = 0
                for r in range(1, 6):
                    raw_tenths = (int(counts.get(r, 0) or 0) * target_tenths) / float(total)
                    floor_tenths = int(raw_tenths)
                    used += floor_tenths
                    raw.append((r, floor_tenths, raw_tenths - floor_tenths))

                remaining = target_tenths - used
                raw.sort(key=lambda x: x[2], reverse=True)
                for i in range(max(0, remaining)):
                    r, _floor_tenths, _rem = raw[i % len(raw)]
                    perc_tenths[r] += 1

                for r, floor_tenths, _rem in raw:
                    perc_tenths[r] += floor_tenths

            return {
                str(r): {
                    "count": int(counts.get(r, 0) or 0),
                    "total": total,
                    "percent": round(perc_tenths[r] / 10.0, 1),
                }
                for r in range(1, 6)
            }

        overall_counts = {r: 0 for r in range(1, 6)}
        overall_agg = (
            Answer.objects.filter(
                response__in=base_responses_qs,
                question__question_type="rating",
                rating__isnull=False,
            )
            .values("rating")
            .annotate(c=Count("id"))
        )
        for row in overall_agg:
            r = int(row["rating"])
            if 1 <= r <= 5:
                overall_counts[r] = int(row["c"])

        overall_total = sum(overall_counts.values())

        # Ensure the displayed percentages (1 decimal place) sum to exactly 100.0%.
        # We compute in tenths-of-a-percent (0.1%) and distribute rounding remainders.
        target_tenths = 1000
        perc_tenths = {r: 0 for r in range(1, 6)}
        if overall_total > 0:
            raw = []
            used = 0
            for r in range(1, 6):
                raw_tenths = (overall_counts[r] * target_tenths) / float(overall_total)
                floor_tenths = int(raw_tenths)
                used += floor_tenths
                raw.append((r, floor_tenths, raw_tenths - floor_tenths))

            remaining = target_tenths - used
            # Distribute remaining tenths to the largest remainders
            raw.sort(key=lambda x: x[2], reverse=True)
            for i in range(max(0, remaining)):
                r, floor_tenths, rem = raw[i % len(raw)]
                perc_tenths[r] += 1

            for r, floor_tenths, rem in raw:
                perc_tenths[r] += floor_tenths

        rating_overview = {
            str(r): {
                "count": overall_counts[r],
                "total": overall_total,
                "percent": round(perc_tenths[r] / 10.0, 1),
            }
            for r in range(1, 6)
        }

        rating_question_overview = {}
        for qid, counts in distributions.items():
            try:
                counts_int = {int(k): int(v) for k, v in counts.items()}
            except Exception:
                counts_int = {r: int(counts.get(r, 0) or 0) for r in range(1, 6)}
            rating_question_overview[str(qid)] = _pct_breakdown_1dp_sum100(counts_int)

        # Rating % by section
        section_rows = list(
            Section.objects.filter(survey=survey)
            .values("id", "title", "order")
            .order_by("order", "id")
        )
        section_meta = {int(r["id"]): r for r in section_rows}

        section_rating_agg = (
            Answer.objects.filter(
                response__in=base_responses_qs,
                question__question_type="rating",
                rating__isnull=False,
            )
            .values("question__section_id", "rating")
            .annotate(c=Count("id"))
        )

        # Build counts per section (including null) for ratings 1..5
        section_counts = {}
        for row in section_rating_agg:
            sid = row.get("question__section_id")  # may be None
            r = int(row.get("rating") or 0)
            if r < 1 or r > 5:
                continue
            if sid not in section_counts:
                section_counts[sid] = {i: 0 for i in range(1, 6)}
            section_counts[sid][r] = int(row.get("c") or 0)

        # Ensure we return all sections even if they have 0 ratings
        for sid in section_meta.keys():
            if sid not in section_counts:
                section_counts[sid] = {i: 0 for i in range(1, 6)}

        rating_section_overview = []
        # Ordered known sections first
        for sid in [int(r["id"]) for r in section_rows]:
            counts = section_counts.get(sid, {i: 0 for i in range(1, 6)})
            meta = section_meta.get(sid) or {}
            rating_section_overview.append({
                "section_id": sid,
                "title": meta.get("title") or "Untitled Section",
                "order": int(meta.get("order") or 0),
                "ratings": _pct_breakdown_1dp_sum100(counts),
            })

        # Include ungrouped/null section ratings if any exist
        if None in section_counts and int(sum(section_counts[None].values())) > 0:
            rating_section_overview.append({
                "section_id": None,
                "title": "Ungrouped",
                "order": 10**9,
                "ratings": _pct_breakdown_1dp_sum100(section_counts[None]),
            })

        # Gender (Sex) distribution: locate question by text ('sex' or 'áŒ¾á‰³')
        gender = None
        sex_q = (
            Question.objects.filter(survey=survey)
            .filter(Q(text__icontains="sex") | Q(text__icontains="áŒ¾á‰³"))
            .order_by("id")
            .first()
        )
        if sex_q:
            def _norm_gender(v: str) -> str | None:
                if v is None:
                    return None
                x = str(v).strip().lower()
                if not x:
                    return None
                if x in ("male", "m", "á‹ˆáŠ•á‹µ"):
                    return "male"
                if x in ("female", "f", "áˆ´á‰µ"):
                    return "female"
                return None

            counts = {"male": 0, "female": 0}
            for row in (
                Answer.objects.filter(response__in=base_responses_qs, question=sex_q)
                .exclude(choice__isnull=True)
                .values("choice")
                .annotate(c=Count("id"))
            ):
                g = _norm_gender(row.get("choice"))
                if g:
                    counts[g] += int(row.get("c") or 0)

            total = int(counts["male"] + counts["female"])
            gender = {
                "question_id": sex_q.id,
                "question": sex_q.text,
                "counts": counts,
                "total": total,
                "percent": {
                    "male": round((counts["male"] / total) * 100.0, 1) if total > 0 else 0.0,
                    "female": round((counts["female"] / total) * 100.0, 1) if total > 0 else 0.0,
                },
            }

        # Age (áŠ¥á‹µáˆœ) distribution: locate question by text ('age' or 'áŠ¥á‹µáˆœ')
        age = None
        age_q = (
            Question.objects.filter(survey=survey)
            .filter(Q(text__icontains="age") | Q(text__icontains="áŠ¥á‹µáˆœ"))
            .order_by("id")
            .first()
        )
        if age_q:
            # Count by selected choice (works best if the question is dropdown/multiple_choice)
            counts_map = {}
            for row in (
                Answer.objects.filter(response__in=base_responses_qs, question=age_q)
                .exclude(choice__isnull=True)
                .values("choice")
                .annotate(c=Count("id"))
            ):
                label = str(row.get("choice") or "").strip()
                if not label:
                    continue
                counts_map[label] = int(row.get("c") or 0) + int(counts_map.get(label, 0))

            total = int(sum(counts_map.values()))
            percent_map = {k: (round((v / total) * 100.0, 1) if total > 0 else 0.0) for k, v in counts_map.items()}
            age = {
                "question_id": age_q.id,
                "question": age_q.text,
                "counts": counts_map,
                "total": total,
                "percent": percent_map,
            }

        # Education level (á‹¨á‰µáˆáˆ…áˆ­á‰µ á‹°áˆ¨áŒƒ) distribution: locate question by text ('education' or 'á‹¨á‰µáˆáˆ…áˆ­á‰µ')
        education = None
        edu_q = (
            Question.objects.filter(survey=survey)
            .filter(Q(text__icontains="education") | Q(text__icontains="á‹¨á‰µáˆáˆ…áˆ­á‰µ"))
            .order_by("id")
            .first()
        )
        if edu_q:
            edu_counts = {}
            for row in (
                Answer.objects.filter(response__in=base_responses_qs, question=edu_q)
                .exclude(choice__isnull=True)
                .values("choice")
                .annotate(c=Count("id"))
            ):
                label = str(row.get("choice") or "").strip()
                if not label:
                    continue
                edu_counts[label] = int(row.get("c") or 0) + int(edu_counts.get(label, 0))

            total = int(sum(edu_counts.values()))
            edu_percent = {k: (round((v / total) * 100.0, 1) if total > 0 else 0.0) for k, v in edu_counts.items()}
            education = {
                "question_id": edu_q.id,
                "question": edu_q.text,
                "counts": edu_counts,
                "total": total,
                "percent": edu_percent,
            }

        return Response({
            "survey": {"id": survey.id, "title": survey.title},
            "totals": {"responses": total_responses},
            "averages": averages,
            "recent": recent,
            "timeseries": timeseries,
            "distributions": distributions,
            "rating_overview": rating_overview,
            "rating_question_overview": rating_question_overview,
            "rating_section_overview": rating_section_overview,
            "gender": gender,
            "age": age,
            "education": education,
            "filters": {"region": region, "from": date_from, "to": date_to, "survey": (int(survey_id) if survey_id and str(survey_id).isdigit() else None)},
        })


class AdminResponsesListView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Admin Responses"],
        description="List responses with filtering and pagination.",
        parameters=[
            OpenApiParameter("survey", OpenApiTypes.INT, OpenApiParameter.QUERY, description="Survey ID"),
            OpenApiParameter("from", OpenApiTypes.DATE, OpenApiParameter.QUERY, description="From date (YYYY-MM-DD), inclusive"),
            OpenApiParameter("to", OpenApiTypes.DATE, OpenApiParameter.QUERY, description="To date (YYYY-MM-DD), inclusive"),
            OpenApiParameter("question", OpenApiTypes.INT, OpenApiParameter.QUERY, description="Filter by question ID"),
            OpenApiParameter("rating_min", OpenApiTypes.INT, OpenApiParameter.QUERY, description="Minimum rating"),
            OpenApiParameter("rating_max", OpenApiTypes.INT, OpenApiParameter.QUERY, description="Maximum rating"),
            OpenApiParameter("page", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("page_size", OpenApiTypes.INT, OpenApiParameter.QUERY),
        ],
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        survey_id = request.query_params.get("survey")
        q_id = request.query_params.get("question")
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        rating_min = request.query_params.get("rating_min")
        rating_max = request.query_params.get("rating_max")

        qs = SurveyResponse.objects.select_related("survey").prefetch_related("answers", "answers__question").all()

        if survey_id:
            qs = qs.filter(survey_id=survey_id)

        # Date filters (inclusive)
        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(submitted_at__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(submitted_at__date__lte=d)

        # Build an answers filter for rating range and/or specific question
        answer_filter = Q()
        if q_id:
            try:
                answer_filter &= Q(answers__question_id=int(q_id))
            except (TypeError, ValueError):
                pass
        if rating_min is not None:
            try:
                rmin = int(rating_min)
                answer_filter &= Q(answers__rating__gte=rmin)
            except (TypeError, ValueError):
                pass
        if rating_max is not None:
            try:
                rmax = int(rating_max)
                answer_filter &= Q(answers__rating__lte=rmax)
            except (TypeError, ValueError):
                pass
        if (q_id or rating_min is not None or rating_max is not None):
            qs = qs.filter(answer_filter)
        qs = qs.order_by("-submitted_at").distinct()

        # Simple pagination
        try:
            page = int(request.query_params.get("page", 1))
            page_size = int(request.query_params.get("page_size", 20))
        except ValueError:
            page, page_size = 1, 20
        total = qs.count()
        start = (page - 1) * page_size
        end = start + page_size
        items = []
        for resp in qs[start:end]:
            answers = [
                {
                    "question_id": a.question_id,
                    "question": a.question.text,
                    "type": a.question.question_type,
                    "rating": a.rating,
                    "comment": a.comment,
                    "choice": a.choice,
                }
                for a in resp.answers.all() if (not q_id or str(a.question_id) == str(q_id))
            ]
            items.append({
                "id": resp.id,
                "submitted_at": resp.submitted_at,
                "survey": {"id": resp.survey_id, "title": resp.survey.title},
                "answers": answers,
            })

        return Response({
            "count": total,
            "page": page,
            "page_size": page_size,
            "results": items,
        })


class AdminResponsesExportExcelView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Admin Responses"],
        description="Export filtered responses to Excel (XLSX).",
        parameters=[
            OpenApiParameter("survey", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("from", OpenApiTypes.DATE, OpenApiParameter.QUERY),
            OpenApiParameter("to", OpenApiTypes.DATE, OpenApiParameter.QUERY),
            OpenApiParameter("question", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("rating_min", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("rating_max", OpenApiTypes.INT, OpenApiParameter.QUERY),
        ],
        responses={200: OpenApiResponse(response=None, description="XLSX file stream")},
    )
    def get(self, request):
        # Reuse list query to fetch all matching (no pagination)
        list_view = AdminResponsesListView()
        list_view.request = request
        # Duplicate filter logic minimally; fetch full list
        survey_id = request.query_params.get("survey")
        q_id = request.query_params.get("question")
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        rating_min = request.query_params.get("rating_min")
        rating_max = request.query_params.get("rating_max")

        qs = SurveyResponse.objects.select_related("survey").prefetch_related("answers", "answers__question").all()
        if survey_id:
            qs = qs.filter(survey_id=survey_id)
        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(submitted_at__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(submitted_at__date__lte=d)
        answer_filter = Q()
        if q_id:
            try:
                answer_filter &= Q(answers__question_id=int(q_id))
            except (TypeError, ValueError):
                pass
        if rating_min is not None:
            try:
                rmin = int(rating_min)
                answer_filter &= Q(answers__rating__gte=rmin)
            except (TypeError, ValueError):
                pass
        if rating_max is not None:
            try:
                rmax = int(rating_max)
                answer_filter &= Q(answers__rating__lte=rmax)
            except (TypeError, ValueError):
                pass
        if (q_id or rating_min is not None or rating_max is not None):
            qs = qs.filter(answer_filter)
        qs = qs.order_by("-submitted_at").distinct()

        data = []
        for resp in qs:
            for a in resp.answers.all():
                include = True
                if q_id and str(a.question_id) != str(q_id):
                    include = False
                if rating_min is not None:
                    try:
                        if a.rating is None or a.rating < int(rating_min):
                            include = False
                    except (TypeError, ValueError):
                        pass
                if rating_max is not None:
                    try:
                        if a.rating is None or a.rating > int(rating_max):
                            include = False
                    except (TypeError, ValueError):
                        pass
                if not include:
                    continue
                data.append({
                    "response_id": resp.id,
                    "submitted_at": resp.submitted_at.isoformat(),
                    "survey_id": resp.survey_id,
                    "survey_title": strip_tags(resp.survey.title),
                    "question_id": a.question_id,
                    "question": a.question.text,
                    "type": a.question.question_type,
                    "rating": a.rating,
                    "comment": a.comment,
                    "choice": a.choice,
                })

        content = export_responses_to_excel(data)
        resp = HttpResponse(content, content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        resp["Content-Disposition"] = 'attachment; filename="responses.xlsx"'
        return resp


class AdminResponsesExportPdfView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Admin Responses"],
        description="Export filtered responses to PDF.",
        parameters=[
            OpenApiParameter("survey", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("from", OpenApiTypes.DATE, OpenApiParameter.QUERY),
            OpenApiParameter("to", OpenApiTypes.DATE, OpenApiParameter.QUERY),
            OpenApiParameter("question", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("rating_min", OpenApiTypes.INT, OpenApiParameter.QUERY),
            OpenApiParameter("rating_max", OpenApiTypes.INT, OpenApiParameter.QUERY),
        ],
        responses={200: OpenApiResponse(response=None, description="PDF file stream")},
    )
    def get(self, request):
        survey_id = request.query_params.get("survey")
        q_id = request.query_params.get("question")
        date_from = request.query_params.get("from")
        date_to = request.query_params.get("to")
        rating_min = request.query_params.get("rating_min")
        rating_max = request.query_params.get("rating_max")

        qs = SurveyResponse.objects.select_related("survey").prefetch_related("answers", "answers__question").all()
        if survey_id:
            qs = qs.filter(survey_id=survey_id)
        if date_from:
            d = parse_date(date_from)
            if d:
                qs = qs.filter(submitted_at__date__gte=d)
        if date_to:
            d = parse_date(date_to)
            if d:
                qs = qs.filter(submitted_at__date__lte=d)
        answer_filter = Q()
        if q_id:
            try:
                answer_filter &= Q(answers__question_id=int(q_id))
            except (TypeError, ValueError):
                pass
        if rating_min is not None:
            try:
                rmin = int(rating_min)
                answer_filter &= Q(answers__rating__gte=rmin)
            except (TypeError, ValueError):
                pass
        if rating_max is not None:
            try:
                rmax = int(rating_max)
                answer_filter &= Q(answers__rating__lte=rmax)
            except (TypeError, ValueError):
                pass
        if (q_id or rating_min is not None or rating_max is not None):
            qs = qs.filter(answer_filter)
        qs = qs.order_by("-submitted_at").distinct()

        data = []
        for resp in qs:
            for a in resp.answers.all():
                include = True
                if q_id and str(a.question_id) != str(q_id):
                    include = False
                if rating_min is not None:
                    try:
                        if a.rating is None or a.rating < int(rating_min):
                            include = False
                    except (TypeError, ValueError):
                        pass
                if rating_max is not None:
                    try:
                        if a.rating is None or a.rating > int(rating_max):
                            include = False
                    except (TypeError, ValueError):
                        pass
                if not include:
                    continue
                data.append({
                    "response_id": resp.id,
                    "submitted_at": resp.submitted_at.isoformat(),
                    "survey_id": resp.survey_id,
                    "survey_title": strip_tags(resp.survey.title),
                    "question_id": a.question_id,
                    "question": a.question.text,
                    "type": a.question.question_type,
                    "rating": a.rating,
                    "comment": a.comment,
                    "choice": a.choice,
                })

        content = export_responses_to_pdf(data)
        resp = HttpResponse(content, content_type="application/pdf")
        resp["Content-Disposition"] = 'attachment; filename="responses.pdf"'
        return resp


class ChangePasswordView(APIView):
    permission_classes = [IsAuthenticated]

    @extend_schema(
        tags=["Admin Auth"],
        description="Allow the currently authenticated admin user to change their own password.",
        request=OpenApiTypes.OBJECT,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        user = request.user
        current_password = request.data.get("current_password")
        new_password = request.data.get("new_password")

        if not current_password or not new_password:
            return Response(
                {"detail": "current_password and new_password are required"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.check_password(current_password):
            return Response(
                {"detail": "Current password is incorrect"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Minimal password strength checks: length and basic complexity
        if len(new_password) < 8:
            return Response(
                {"detail": "New password must be at least 8 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_password.isdigit() or new_password.isalpha():
            return Response(
                {"detail": "New password must contain both letters and numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"detail": "Password changed successfully"}, status=status.HTTP_200_OK)


class AdminUserListCreateView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        tags=["Admin Users"],
        description="List admin users (super_admin, survey_designer, viewer) or create a new one.",
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request):
        users = User.objects.all().order_by("id")
        data = []
        for u in users:
            data.append(
                {
                    "id": u.id,
                    "username": u.username,
                    "full_name": getattr(u, "get_full_name", lambda: "")() or u.username,
                    "role": _get_user_role(u),
                }
            )
        return Response({"results": data})

    @extend_schema(
        tags=["Admin Users"],
        description="Create a new admin user with a given role and initial password.",
        request=OpenApiTypes.OBJECT,
        responses={201: OpenApiTypes.OBJECT},
    )
    def post(self, request):
        username = request.data.get("username")
        password = request.data.get("password")
        role = request.data.get("role", "viewer")

        if not username or not password:
            return Response({"detail": "username and password are required"}, status=status.HTTP_400_BAD_REQUEST)

        if role not in ("super_admin", "survey_designer", "viewer"):
            return Response({"detail": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)

        if User.objects.filter(username=username).exists():
            return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)

        user = User(username=username)

        # Map portal role to Django flags + optional role field
        if hasattr(user, "role"):
            user.role = role
        user.is_superuser = role == "super_admin"
        user.is_staff = role in ("super_admin", "survey_designer")
        user.set_password(password)
        user.save()

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "full_name": getattr(user, "get_full_name", lambda: "")() or user.username,
                "role": _get_user_role(user),
            },
            status=status.HTTP_201_CREATED,
        )


class AdminUserDetailView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        tags=["Admin Users"],
        description="Retrieve, update, or delete a specific admin user.",
        responses={200: OpenApiTypes.OBJECT},
    )
    def get(self, request, pk: int):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "full_name": getattr(user, "get_full_name", lambda: "")() or user.username,
                "role": _get_user_role(user),
            }
        )

    def patch(self, request, pk: int):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        username = request.data.get("username")
        role = request.data.get("role")

        if username:
            if User.objects.exclude(pk=user.pk).filter(username=username).exists():
                return Response({"detail": "Username already exists"}, status=status.HTTP_400_BAD_REQUEST)
            user.username = username

        if role:
            if role not in ("super_admin", "survey_designer", "viewer"):
                return Response({"detail": "Invalid role"}, status=status.HTTP_400_BAD_REQUEST)
            if hasattr(user, "role"):
                user.role = role
            user.is_superuser = role == "super_admin"
            user.is_staff = role in ("super_admin", "survey_designer")

        user.save()

        return Response(
            {
                "id": user.id,
                "username": user.username,
                "full_name": getattr(user, "get_full_name", lambda: "")() or user.username,
                "role": _get_user_role(user),
            }
        )

    def delete(self, request, pk: int):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        # Prevent deleting yourself
        if request.user.pk == user.pk:
            return Response({"detail": "You cannot delete your own account."}, status=status.HTTP_400_BAD_REQUEST)

        user.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class AdminUserResetPasswordView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        tags=["Admin Users"],
        description="Reset another admin user's password (super_admin only).",
        request=OpenApiTypes.OBJECT,
        responses={200: OpenApiTypes.OBJECT},
    )
    def post(self, request, pk: int):
        try:
            user = User.objects.get(pk=pk)
        except User.DoesNotExist:
            return Response({"detail": "User not found"}, status=status.HTTP_404_NOT_FOUND)

        new_password = request.data.get("new_password")
        if not new_password:
            return Response({"detail": "new_password is required"}, status=status.HTTP_400_BAD_REQUEST)

        if len(new_password) < 8:
            return Response(
                {"detail": "New password must be at least 8 characters long."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if new_password.isdigit() or new_password.isalpha():
            return Response(
                {"detail": "New password must contain both letters and numbers."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user.set_password(new_password)
        user.save(update_fields=["password"])

        return Response({"detail": "Password reset successfully"}, status=status.HTTP_200_OK)















