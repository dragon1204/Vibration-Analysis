export function isEmailOrPhoneNumber(input: string): number {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
  const phoneNumberRegex = /^([+]\d{1,3})?\d{10}$/;

  if (emailRegex.test(input)) {
    return 1;
  } else if (phoneNumberRegex.test(input)) {
    return 2;
  } else {
    return 0;
  }
}
