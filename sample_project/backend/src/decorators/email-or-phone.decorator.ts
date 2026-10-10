import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';

@ValidatorConstraint({ name: 'isEmailOrPhone', async: false })
export class IsEmailOrPhone implements ValidatorConstraintInterface {
  validate(text: string, args: ValidationArguments) {
    const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;
    const phoneNumberRegex = /^([+]\d{1,3})?\d{10}$/;
    return emailRegex.test(text) || phoneNumberRegex.test(text);
  }

  defaultMessage(args: ValidationArguments) {
    return 'Text ($value) must be a valid email or phone number!';
  }
}
