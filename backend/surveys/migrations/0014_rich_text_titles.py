from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("surveys", "0013_sections"),
    ]

    operations = [
        migrations.AlterField(
            model_name="survey",
            name="title",
            field=models.TextField(),
        ),
        migrations.AlterField(
            model_name="survey",
            name="header_title",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="section",
            name="title",
            field=models.TextField(blank=True, default=""),
        ),
    ]
