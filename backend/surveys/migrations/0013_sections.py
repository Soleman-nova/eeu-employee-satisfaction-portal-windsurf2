from django.db import migrations, models
import django.db.models.deletion


def backfill_sections(apps, schema_editor):
    Survey = apps.get_model("surveys", "Survey")
    Section = apps.get_model("surveys", "Section")
    Question = apps.get_model("surveys", "Question")

    for survey in Survey.objects.all().order_by("id"):
        section = Section.objects.create(
            survey_id=survey.id,
            title="Untitled Section",
            description="",
            order=0,
        )
        Question.objects.filter(survey_id=survey.id, section__isnull=True).update(section_id=section.id)


def reverse_backfill_sections(apps, schema_editor):
    # Best-effort rollback: detach questions and delete sections.
    Question = apps.get_model("surveys", "Question")
    Section = apps.get_model("surveys", "Section")

    Question.objects.update(section=None)
    Section.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0012_alter_question_question_type"),
    ]

    operations = [
        migrations.CreateModel(
            name="Section",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("title", models.CharField(blank=True, default="", max_length=200)),
                ("description", models.TextField(blank=True, default="")),
                ("order", models.IntegerField(default=0)),
                (
                    "survey",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="sections", to="surveys.survey"),
                ),
            ],
            options={
                "ordering": ["order", "id"],
            },
        ),
        migrations.AddField(
            model_name="question",
            name="section",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="questions", to="surveys.section"),
        ),
        migrations.RunPython(backfill_sections, reverse_backfill_sections),
    ]
