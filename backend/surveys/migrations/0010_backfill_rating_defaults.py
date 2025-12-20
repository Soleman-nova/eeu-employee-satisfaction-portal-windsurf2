from django.db import migrations


DEFAULT_LABELS = {
    "1": "Very Dissatisfied",
    "2": "Dissatisfied",
    "3": "Neutral",
    "4": "Satisfied",
    "5": "Very Satisfied",
}


def backfill_rating_defaults(apps, schema_editor):
    Question = apps.get_model('surveys', 'Question')

    qs = Question.objects.filter(question_type='rating')
    for q in qs:
        changed = False

        # default labels
        if not q.linear_scale_labels:
            q.linear_scale_labels = dict(DEFAULT_LABELS)
            changed = True

        # default display style
        if not getattr(q, 'rating_display_style', ''):
            q.rating_display_style = 'stars'
            changed = True

        if changed:
            q.save(update_fields=['linear_scale_labels', 'rating_display_style'])


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0009_question_rating_display_style'),
    ]

    operations = [
        migrations.RunPython(backfill_rating_defaults, migrations.RunPython.noop),
    ]
