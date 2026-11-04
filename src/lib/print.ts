// No "noopener" here: with it, window.open returns null and the document cannot be written.
export const printHtml = (html: string) => {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return false;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  window.setTimeout(() => printWindow.print(), 250);
  return true;
};
