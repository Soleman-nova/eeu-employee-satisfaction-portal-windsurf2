from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0015_survey_language"),
    ]

    operations = [
        migrations.CreateModel(
            name="SurveyAttempt",
            fields=[
                ("fingerprint_hash", models.CharField(max_length=128, primary_key=True, serialize=False)),
                ("attempts", models.IntegerField(default=0)),
                ("last_submitted", models.DateTimeField(blank=True, null=True)),
            ],
        ),
        migrations.AlterUniqueTogether(
            name="response",
            unique_together=set(),
        ),
    ]
