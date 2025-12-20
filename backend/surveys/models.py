from django.db import models


class Survey(models.Model):
    title = models.TextField()
    description = models.TextField(blank=True)
    header_title = models.TextField(blank=True, default="")
    header_subtitle = models.TextField(blank=True, default="")
    is_active = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title


class Section(models.Model):
    survey = models.ForeignKey(Survey, related_name="sections", on_delete=models.CASCADE)
    title = models.TextField(blank=True, default="")
    description = models.TextField(blank=True, default="")
    order = models.IntegerField(default=0)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.survey.title} - {self.title[:50]}"


class Question(models.Model):
    QUESTION_TYPE_CHOICES = (
        ("rating", "Rating"),
        ("text", "Text"),
        ("regions", "Regions"),
        ("dropdown", "Dropdown"),
        ("multiple_choice", "Multiple Choice"),
        ("linear_scale", "Linear Scale"),
        ("paragraph", "Paragraph"),
    )
    survey = models.ForeignKey(Survey, related_name="questions", on_delete=models.CASCADE)
    section = models.ForeignKey(Section, related_name="questions", on_delete=models.CASCADE, null=True, blank=True)
    text = models.CharField(max_length=300)
    question_type = models.CharField(max_length=20, choices=QUESTION_TYPE_CHOICES)
    order = models.IntegerField(default=0)
    required = models.BooleanField(default=True)
    # For dropdown / multiple choice questions, store one option per line
    options = models.TextField(blank=True)
    # For linear scale questions, allow custom end labels (e.g., Very Dissatisfied / Very Satisfied)
    scale_min_label = models.CharField(max_length=100, blank=True)
    scale_max_label = models.CharField(max_length=100, blank=True)
    # For linear scale questions, allow per-point labels (1..5)
    linear_scale_labels = models.JSONField(null=True, blank=True)
    # For rating questions, store how to display the 1..5 options (stars/emojis/numbers)
    rating_display_style = models.CharField(max_length=20, blank=True)
    # Optional max characters for text questions (e.g., 300 for short text, 500 for paragraph)
    max_chars = models.IntegerField(null=True, blank=True)

    def __str__(self):
        return f"{self.survey.title} - {self.text[:50]}"

    class Meta:
        ordering = ["order", "id"]


class Response(models.Model):
    survey = models.ForeignKey(Survey, related_name="responses", on_delete=models.CASCADE)
    submitted_at = models.DateTimeField(auto_now_add=True)
    # Store AD domain username for employee identification (e.g., "DOMAIN\\username")
    employee_identifier = models.CharField(max_length=255, blank=True, null=True)
    
    class Meta:
        # Ensure one response per employee per survey
        unique_together = ("survey", "employee_identifier")


class Answer(models.Model):
    response = models.ForeignKey(Response, related_name="answers", on_delete=models.CASCADE)
    question = models.ForeignKey(Question, related_name="answers", on_delete=models.CASCADE)
    rating = models.IntegerField(null=True, blank=True)
    comment = models.TextField(blank=True)
    # For dropdown / multiple choice questions, store the selected option text
    choice = models.CharField(max_length=300, blank=True)

    class Meta:
        unique_together = ("response", "question")

# class Region(models.Model):
#     value = models.CharField(max_length=10, unique=True)
#     title = models.CharField(max_length=100)
#     lang_code = models.CharField(max_length=10)

    
#     def __str__(self):
#         return self.title