import { states } from "./data";

export type ProfileFields = {
  username: string;
  name: string;
  country: string;
  region: string;
  bio: string;
  accept: boolean;
};
export type ProfileErrors = Partial<Record<keyof ProfileFields, string>>;

export function validateProfile(fields: ProfileFields, onboarding: boolean) {
  const errors: ProfileErrors = {};
  const { username, name, country, region, bio, accept } = fields;
  const length = (value: string) => Array.from(value.trim()).length;
  if (!username.trim()) errors.username = "Enter a username.";
  else if (username.length < 3) errors.username = "Use at least 3 characters.";
  else if (username.length > 20)
    errors.username = "Use 20 characters or fewer.";
  else if (/[A-Z]/.test(username))
    errors.username =
      "Use lowercase letters. Uppercase letters aren’t allowed.";
  else if (!/^[a-z0-9_]+$/.test(username))
    errors.username =
      "Use only lowercase letters, numbers and underscores. Spaces and other symbols aren’t allowed.";
  if (!name.trim()) errors.name = "Enter your display name.";
  else if (length(name) > 60)
    errors.name = "Use 60 characters or fewer for your display name.";
  if (!country.trim()) errors.country = "Enter your country.";
  else if (length(country) > 80)
    errors.country = "Use 80 characters or fewer for your country.";
  if (country.trim().toLowerCase() === "nigeria" && !states.includes(region))
    errors.region = "Choose your Nigerian state or the FCT.";
  else if (length(region) > 80)
    errors.region = "Use 80 characters or fewer for your city.";
  if (length(bio) > 160)
    errors.bio = "Shorten your bio to 160 characters or fewer.";
  if (onboarding && !accept)
    errors.accept = "Accept the Terms and Privacy Policy to finish.";
  return errors;
}
