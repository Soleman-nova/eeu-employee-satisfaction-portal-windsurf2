import os
import logging
from django.contrib.auth import get_user_model
from django.conf import settings

logger = logging.getLogger(__name__)

def get_employee_identifier(request=None) -> str:
    """
    Get the employee identifier from Active Directory environment variables.
    Returns the domain\\username format for employee identification.
    
    This function works in Windows environments where the survey is accessed
    through enterprise authentication or when running on domain-joined machines.
    
    Returns:
        str: Employee identifier in format "DOMAIN\\username" or empty string if not available
    """
    try:
        # Prefer request-provided identity (Windows/IIS auth or reverse proxy headers)
        if request is not None:
            meta = getattr(request, "META", {}) or {}
            raw = (
                meta.get("REMOTE_USER")
                or meta.get("HTTP_REMOTE_USER")
                or meta.get("HTTP_X_FORWARDED_USER")
                or meta.get("HTTP_X_REMOTE_USER")
                or meta.get("HTTP_X_MS_CLIENT_PRINCIPAL_NAME")
                or meta.get("HTTP_X_MS_CLIENT_PRINCIPAL")
            )

            if raw:
                raw = str(raw).strip()
                # Normalize user@domain into DOMAIN\user when possible
                if "@" in raw and "\\" not in raw:
                    user_part, domain_part = raw.split("@", 1)
                    if user_part and domain_part:
                        return f"{domain_part}\\{user_part}"
                return raw

        # In production, do NOT fall back to server environment variables (they're server identity)
        # Only allow env fallback in DEBUG/local dev.
        if not getattr(settings, "DEBUG", False):
            return ""

        # Try to get username and domain from environment variables
        username = os.environ.get('USERNAME', '')
        domain = os.environ.get('USERDOMAIN', '')
        
        # If we have both username and domain, return the full identifier
        if username and domain:
            employee_id = f"{domain}\\{username}"
            logger.info(f"Employee identifier detected: {employee_id}")
            return employee_id
        
        # Fallback: try other common environment variables
        fallback_username = os.environ.get('USER', '') or os.environ.get('LOGNAME', '')
        fallback_domain = os.environ.get('COMPUTERNAME', '')
        
        if fallback_username and fallback_domain:
            employee_id = f"{fallback_domain}\\{fallback_username}"
            logger.info(f"Employee identifier (fallback): {employee_id}")
            return employee_id
            
        logger.warning("Could not determine employee identifier from environment variables")
        return ""
        
    except Exception as e:
        logger.error(f"Error getting employee identifier: {e}")
        return ""

def is_admin_user(employee_identifier: str, request=None) -> bool:
    """
    Check if the current user is an admin (Super_admin or survey_designer).
    
    Args:
        employee_identifier: The employee's AD identifier
        
    Returns:
        bool: True if user is admin, False otherwise
    """
    # If the request is authenticated (e.g., admin has JWT/session), trust request.user.
    try:
        if request is not None:
            user = getattr(request, "user", None)
            if user is not None and getattr(user, "is_authenticated", False):
                from accounts.views import _get_user_role
                role = _get_user_role(user)
                return role in ("super_admin", "survey_designer", "viewer")
    except Exception as e:
        logger.error(f"Error checking admin status via request.user: {e}")

    if not employee_identifier:
        return False
        
    try:
        # Extract username from DOMAIN\\username format
        username = employee_identifier.split('\\')[-1] if '\\' in employee_identifier else employee_identifier
        
        # Check if user exists and has admin roles
        User = get_user_model()
        user = User.objects.filter(username=username).first()
        if not user:
            return False
            
        # Check if user is super_admin or survey_designer
        from accounts.views import _get_user_role
        role = _get_user_role(user)
        return role in ("super_admin", "survey_designer", "viewer")
        
    except Exception as e:
        logger.error(f"Error checking admin status: {e}")
        return False

def has_employee_responded(survey_id: int, employee_identifier: str) -> bool:
    """
    Check if an employee has already responded to a specific survey.
    
    Args:
        survey_id: The ID of the survey to check
        employee_identifier: The employee's AD identifier
        
    Returns:
        bool: True if employee has already responded, False otherwise
    """
    if not employee_identifier:
        return False
        
    try:
        from surveys.models import Response
        return Response.objects.filter(
            survey_id=survey_id,
            employee_identifier=employee_identifier
        ).exists()
    except Exception as e:
        logger.error(f"Error checking employee response: {e}")
        return False
