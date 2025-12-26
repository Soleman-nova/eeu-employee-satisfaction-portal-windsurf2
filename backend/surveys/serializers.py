from rest_framework import serializers
from django.utils import timezone
from .models import Survey, Section, Question, Response, Answer


class QuestionSerializer(serializers.ModelSerializer):
    maxChars = serializers.IntegerField(source="max_chars", required=False, allow_null=True)
    labels = serializers.JSONField(source="linear_scale_labels", required=False, allow_null=True)
    displayStyle = serializers.CharField(source="rating_display_style", required=False, allow_blank=True)

    class Meta:
        model = Question
        fields = [
            "id",
            "text",
            "question_type",
            "order",
            "required",
            "options",
            "scale_min_label",
            "scale_max_label",
            "labels",
            "displayStyle",
            "maxChars",
        ]


class SurveySerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    sections = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            "id",
            "title",
            "description",
            "header_title",
            "header_subtitle",
            "language",
            "budget_year",
            "is_active",
            "created_at",
            "sections",
            # Keep legacy flat list for backwards compatibility with older clients.
            "questions",
        ]

    def get_sections(self, obj):
        # Backwards compatible: if no sections exist yet, return a single default section.
        sections = list(getattr(obj, "sections", []).all()) if hasattr(obj, "sections") else []
        if not sections:
            qs = list(obj.questions.all().order_by("order", "id"))
            return [
                {
                    "id": None,
                    "title": "Untitled Section",
                    "description": "",
                    "order": 0,
                    "questions": QuestionSerializer(qs, many=True).data,
                }
            ]

        out = []
        for s in sections:
            qset = s.questions.all().order_by("order", "id")
            out.append(
                {
                    "id": s.id,
                    "title": s.title,
                    "description": s.description,
                    "order": s.order,
                    "questions": QuestionSerializer(qset, many=True).data,
                }
            )
        return out


class AnswerCreateSerializer(serializers.Serializer):
    question = serializers.IntegerField()
    rating = serializers.IntegerField(required=False, allow_null=True)
    comment = serializers.CharField(required=False, allow_blank=True, allow_null=True)
    choice = serializers.CharField(required=False, allow_blank=True, allow_null=True)


class SubmitSurveySerializer(serializers.Serializer):
    survey = serializers.IntegerField()
    answers = AnswerCreateSerializer(many=True)

    def validate(self, data):
        survey_id = data["survey"]
        try:
            survey = Survey.objects.get(id=survey_id)
        except Survey.DoesNotExist:
            raise serializers.ValidationError("Survey not found")
        # Ensure all questions belong to this survey
        qids = {a["question"] for a in data["answers"]}
        qs = Question.objects.filter(survey_id=survey_id, id__in=qids)
        valid_ids = set(qs.values_list("id", flat=True))
        if qids - valid_ids:
            raise serializers.ValidationError("One or more questions do not belong to the specified survey")

        q_by_id = {q.id: q for q in qs}

        # Validate per question type and required flag
        for a in data["answers"]:
            qobj = q_by_id.get(a["question"])
            if not qobj:
                continue
            qtype = qobj.question_type
            rating = a.get("rating")
            comment = a.get("comment")
            choice = a.get("choice")

            if rating is not None and not (1 <= int(rating) <= 5):
                raise serializers.ValidationError("Ratings must be between 1 and 5")

            comment_str = (comment or "").strip()
            choice_str = (choice or "").strip()

            if qobj.required:
                if qtype in ["rating", "linear_scale"]:
                    if rating is None:
                        raise serializers.ValidationError("A rating is required for required scale questions")
                elif qtype in ["dropdown", "multiple_choice", "regions"]:
                    if not choice_str:
                        raise serializers.ValidationError("A choice is required for required selection questions")
                else:  # text / paragraph
                    if not comment_str:
                        raise serializers.ValidationError("An answer is required for required text questions")
        data["_survey_obj"] = survey
        return data

    def create(self, validated_data):
        survey = validated_data["_survey_obj"]
        employee_identifier = validated_data.pop("employee_identifier", None)
        admin_bypass = bool(validated_data.pop("_admin_bypass", False))

        # For admin-bypass submissions we intentionally do NOT persist employee_identifier,
        # so admins can submit multiple times without hitting the (survey, employee_identifier)
        # unique constraint.
        resp = Response.objects.create(
            survey=survey,
            employee_identifier=None if admin_bypass else employee_identifier,
        )
        bulk = []
        for a in validated_data["answers"]:
            bulk.append(
                Answer(
                    response=resp,
                    question_id=a["question"],
                    rating=a.get("rating"),
                    comment=a.get("comment") or "",
                    choice=(a.get("choice") or ""),
                )
            )
        Answer.objects.bulk_create(bulk)
        return resp


# Admin serializers
class QuestionCreateSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    text = serializers.CharField(max_length=300)
    question_type = serializers.ChoiceField(
        choices=["rating", "text", "regions", "dropdown", "multiple_choice", "linear_scale", "paragraph"]
    )
    order = serializers.IntegerField(required=False)
    required = serializers.BooleanField(required=False)
    options = serializers.CharField(required=False, allow_blank=True)
    scale_min_label = serializers.CharField(required=False, allow_blank=True)
    scale_max_label = serializers.CharField(required=False, allow_blank=True)
    labels = serializers.JSONField(required=False, allow_null=True)
    displayStyle = serializers.ChoiceField(choices=["stars", "emojis", "numbers"], required=False)
    maxChars = serializers.IntegerField(required=False, allow_null=True)


class SectionCreateSerializer(serializers.Serializer):
    id = serializers.IntegerField(required=False)
    title = serializers.CharField(required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    order = serializers.IntegerField(required=False)
    questions = QuestionCreateSerializer(many=True, required=False)


class SurveyCreateUpdateSerializer(serializers.ModelSerializer):
    questions = QuestionCreateSerializer(many=True, required=False)
    sections = SectionCreateSerializer(many=True, required=False)

    class Meta:
        model = Survey
        fields = [
            "id",
            "title",
            "description",
            "header_title",
            "header_subtitle",
            "language",
            "budget_year",
            "is_active",
            "sections",
            # Legacy support
            "questions",
        ]

    def create(self, validated_data):
        sections_payload = validated_data.pop("sections", None)
        questions = validated_data.pop("questions", [])
        # If creating with is_active=True, deactivate others
        if validated_data.get("is_active"):
            Survey.objects.filter(is_active=True).update(is_active=False)
        # Default budget_year to current year if not provided
        if validated_data.get("budget_year") is None:
            validated_data["budget_year"] = timezone.now().year
        survey = Survey.objects.create(**validated_data)
        if sections_payload is None:
            # Backwards compatible: create a default section and put all questions in it.
            sections_payload = [
                {
                    "title": "Untitled Section",
                    "description": "",
                    "order": 0,
                    "questions": questions,
                }
            ]

        for s_idx, s in enumerate(sections_payload or []):
            section = Section.objects.create(
                survey=survey,
                title=(s.get("title") or "Untitled Section").strip(),
                description=(s.get("description") or "").strip(),
                order=int(s.get("order", s_idx) or 0),
            )
            q_payload = s.get("questions") or []
            bulk_q = []
            for idx, q in enumerate(q_payload):
                max_chars = q.get("maxChars")
                labels = q.get("labels")
                display_style = q.get("displayStyle")
                min_label = q.get("scale_min_label", "")
                max_label = q.get("scale_max_label", "")
                if isinstance(labels, dict):
                    min_label = labels.get("1") or labels.get(1) or min_label
                    max_label = labels.get("5") or labels.get(5) or max_label

                rating_display_style = ""
                if q.get("question_type") == "rating":
                    rating_display_style = display_style or "stars"
                bulk_q.append(
                    Question(
                        survey=survey,
                        section=section,
                        text=q["text"],
                        question_type=q["question_type"],
                        order=q.get("order", idx),
                        required=q.get("required", True),
                        options=q.get("options", ""),
                        scale_min_label=min_label,
                        scale_max_label=max_label,
                        linear_scale_labels=labels,
                        rating_display_style=rating_display_style,
                        max_chars=max_chars,
                    )
                )
            if bulk_q:
                Question.objects.bulk_create(bulk_q)
        return survey

    def update(self, instance, validated_data):
        # Handle is_active toggle (ensure single active)
        if validated_data.get("is_active") and not instance.is_active:
            Survey.objects.filter(is_active=True).update(is_active=False)

        sections_payload = validated_data.pop("sections", None)
        questions_payload = validated_data.pop("questions", None)

        # Update survey basic fields first
        instance = super().update(instance, validated_data)

        # If sections are provided, treat as authoritative (section + question structure).
        # If only legacy questions payload provided, map them into a single default section.
        if sections_payload is None and questions_payload is not None:
            # Ensure at least one section exists.
            section = instance.sections.order_by("order", "id").first()
            if not section:
                section = Section.objects.create(survey=instance, title="Untitled Section", description="", order=0)
            sections_payload = [
                {
                    "id": section.id,
                    "title": section.title,
                    "description": section.description,
                    "order": section.order,
                    "questions": questions_payload,
                }
            ]

        if sections_payload is not None:
            from django.db import transaction
            with transaction.atomic():
                existing_sections = {s.id: s for s in instance.sections.all()}
                existing_qs = {q.id: q for q in instance.questions.all()}
                payload_q_ids = set()
                payload_section_ids = set()

                for s_pos, sd in enumerate(sections_payload):
                    s_id = sd.get("id")
                    s_title = (sd.get("title") or "Untitled Section").strip()
                    s_desc = (sd.get("description") or "").strip()
                    s_order = int(sd.get("order", s_pos) or 0)

                    if s_id and s_id in existing_sections:
                        sobj = existing_sections[s_id]
                        changed = []
                        if sobj.title != s_title:
                            sobj.title = s_title
                            changed.append("title")
                        if sobj.description != s_desc:
                            sobj.description = s_desc
                            changed.append("description")
                        if sobj.order != s_order:
                            sobj.order = s_order
                            changed.append("order")
                        if changed:
                            sobj.save(update_fields=changed)
                        section_obj = sobj
                    else:
                        section_obj = Section.objects.create(
                            survey=instance,
                            title=s_title,
                            description=s_desc,
                            order=s_order,
                        )
                    payload_section_ids.add(section_obj.id)

                    for position, qd in enumerate(sd.get("questions") or []):
                        q_id = qd.get("id")
                        text = qd.get("text", "").strip()
                        qtype = qd.get("question_type")
                        order = qd.get("order", position)
                        required = qd.get("required", True)
                        options = qd.get("options", "")
                        scale_min_label = qd.get("scale_min_label", "")
                        scale_max_label = qd.get("scale_max_label", "")
                        labels = qd.get("labels")
                        display_style = qd.get("displayStyle")
                        if isinstance(labels, dict):
                            scale_min_label = labels.get("1") or labels.get(1) or scale_min_label
                            scale_max_label = labels.get("5") or labels.get(5) or scale_max_label
                        max_chars = qd.get("maxChars")

                        if q_id and q_id in existing_qs:
                            qobj = existing_qs[q_id]
                            changed_fields = []

                            if text and qobj.text != text:
                                qobj.text = text
                                changed_fields.append("text")
                            if qtype and qobj.question_type != qtype:
                                qobj.question_type = qtype
                                changed_fields.append("question_type")
                            if qobj.order != order:
                                qobj.order = order
                                changed_fields.append("order")
                            if qobj.required != required:
                                qobj.required = required
                                changed_fields.append("required")
                            if qobj.options != options:
                                qobj.options = options
                                changed_fields.append("options")
                            if qobj.scale_min_label != scale_min_label:
                                qobj.scale_min_label = scale_min_label
                                changed_fields.append("scale_min_label")
                            if qobj.scale_max_label != scale_max_label:
                                qobj.scale_max_label = scale_max_label
                                changed_fields.append("scale_max_label")
                            if qobj.section_id != section_obj.id:
                                qobj.section = section_obj
                                changed_fields.append("section")

                            if qobj.linear_scale_labels != labels:
                                qobj.linear_scale_labels = labels
                                changed_fields.append("linear_scale_labels")

                            next_rating_style = ""
                            if qtype == "rating":
                                next_rating_style = display_style or (qobj.rating_display_style or "stars")
                            if qobj.rating_display_style != next_rating_style:
                                qobj.rating_display_style = next_rating_style
                                changed_fields.append("rating_display_style")

                            if qobj.max_chars != max_chars:
                                qobj.max_chars = max_chars
                                changed_fields.append("max_chars")

                            if changed_fields:
                                qobj.save(update_fields=changed_fields)
                            payload_q_ids.add(q_id)
                        else:
                            qnew = Question.objects.create(
                                survey=instance,
                                section=section_obj,
                                text=text,
                                question_type=qtype,
                                order=order,
                                required=required,
                                options=options,
                                scale_min_label=scale_min_label,
                                scale_max_label=scale_max_label,
                                linear_scale_labels=labels,
                                rating_display_style=(display_style or "stars") if qtype == "rating" else "",
                                max_chars=max_chars,
                            )
                            payload_q_ids.add(qnew.id)

                # Delete any existing questions not present in payload
                to_delete_ids = [qid for qid in existing_qs.keys() if qid not in payload_q_ids]
                if to_delete_ids:
                    Question.objects.filter(id__in=to_delete_ids, survey=instance).delete()

                # Delete any sections not present in payload (will cascade delete their questions if any remain)
                to_delete_sections = [sid for sid in existing_sections.keys() if sid not in payload_section_ids]
                if to_delete_sections:
                    Section.objects.filter(id__in=to_delete_sections, survey=instance).delete()

        return instance


class SurveyDetailSerializer(serializers.ModelSerializer):
    questions = QuestionSerializer(many=True, read_only=True)
    sections = serializers.SerializerMethodField()

    class Meta:
        model = Survey
        fields = [
            "id",
            "title",
            "description",
            "header_title",
            "header_subtitle",
            "language",
            "budget_year",
            "is_active",
            "created_at",
            "sections",
            "questions",
        ]

    def get_sections(self, obj):
        return SurveySerializer(obj, context=self.context).data.get("sections")


class ResponseSummarySerializer(serializers.Serializer):
    id = serializers.IntegerField()
    submitted_at = serializers.DateTimeField()
