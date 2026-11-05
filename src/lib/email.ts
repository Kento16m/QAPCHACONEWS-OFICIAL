// Same rule as the newsletter_email_format check in the database.
export const parseEmail = (value: string) => {
  const email = value.trim();
  return email.length <= 255 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
};
