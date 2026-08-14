/** Joins conditional class names, dropping the ones that did not apply. */
export const classes = (values: (string | false | null | undefined)[]) =>
  values.filter(Boolean).join(' ')
