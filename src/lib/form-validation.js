export function getValidationMessage(field) {
  if (!field?.validity) return "Please check this field.";

  if (field.validity.valueMissing) {
    return `${field.dataset.label || field.name || "This field"} is required.`;
  }

  if (field.validity.typeMismatch) {
    if (field.type === "email") return "Please enter a valid email address.";
    return `Please enter a valid ${field.dataset.label || field.type || "value"}.`;
  }

  if (field.validity.tooShort) {
    return `${field.dataset.label || field.name || "This field"} must be at least ${field.minLength} characters.`;
  }

  if (field.validity.patternMismatch) {
    return field.dataset.patternMessage || `Please enter a valid ${field.dataset.label || field.name || "value"}.`;
  }

  return "Please check this field.";
}

export function handleFormInvalid(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
  field.setCustomValidity(getValidationMessage(field));
}

export function clearFieldValidity(event) {
  const field = event.target;
  if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) return;
  field.setCustomValidity("");
}
