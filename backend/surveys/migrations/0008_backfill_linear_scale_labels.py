from django.db import migrations


DEFAULT_LABELS = {
    "1": "Very Dissatisfied",
    "2": "Dissatisfied",
    "3": "Neutral",
    "4": "Satisfied",
    "5": "Very Satisfied",
}


def backfill_linear_scale_labels(apps, schema_editor):
    Question = apps.get_model('surveys', 'Question')

    qs = Question.objects.filter(question_type='linear_scale')
    for q in qs:
        if q.linear_scale_labels:
            continue

        labels = dict(DEFAULT_LABELS)
        if getattr(q, 'scale_min_label', None):
            labels["1"] = q.scale_min_label
        if getattr(q, 'scale_max_label', None):
            labels["5"] = q.scale_max_label

        q.linear_scale_labels = labels
        q.save(update_fields=['linear_scale_labels'])


class Migration(migrations.Migration):

    dependencies = [
        ('surveys', '0007_question_linear_scale_labels'),
    ]

    operations = [
        migrations.RunPython(backfill_linear_scale_labels, migrations.RunPython.noop),
    ]
