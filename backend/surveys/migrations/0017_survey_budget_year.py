from django.db import migrations, models


def backfill_budget_year(apps, schema_editor):
    Survey = apps.get_model('surveys', 'Survey')
    for s in Survey.objects.all():
        year = None
        try:
            if s.created_at:
                year = s.created_at.year
        except Exception:
            year = None
        if year is not None and getattr(s, 'budget_year', None) in (None, ''):
            s.budget_year = year
            s.save(update_fields=['budget_year'])


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0016_survey_attempts'),
    ]

    operations = [
        migrations.AddField(
            model_name='survey',
            name='budget_year',
            field=models.IntegerField(null=True, blank=True, db_index=True),
        ),
        migrations.RunPython(backfill_budget_year, migrations.RunPython.noop),
    ]
