export const categories = [
  "Politics",
  "Economy",
  "Education",
  "Jobs",
  "Social",
  "Everyday Life",
];
export const tags = [
  "Hustle",
  "Education",
  "Money",
  "Health System",
  "Transport",
  "Light & Power",
  "Relocation",
  "Wins",
];
export const reasons = [
  "Sensitive or identifying information",
  "Harassment",
  "Spam",
  "Harmful or misleading content",
  "Other",
];
export type Kind = "square" | "diary";
export type Profile = {
  username: string;
  display_name: string;
  country: string;
  region: string | null;
  bio: string | null;
  abroad: boolean;
  avatar_url: string | null;
  completed_at?: string | null;
};
export type Entry = {
  id: string;
  kind: Kind;
  title: string;
  body: string;
  category: string;
  created_at: string;
  author: Profile | null;
  anonymous: boolean;
  replies: number;
  reactions: number;
  relate: number;
  mine: string | null;
  owned: boolean;
  parent_id?: string | null;
  hidden?: boolean;
  cursor_score?: string;
  circle?: { slug: string; name: string } | null;
  system_seed?: boolean;
};
export const diaryReactions = ["I relate", "Been there", "Respect"];
export const states = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Abuja (FCT)",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];
export function age(date: string) {
  const hours = Math.max(
    0,
    Math.floor((Date.now() - Date.parse(date)) / 3600000),
  );
  return hours < 1
    ? "Just now"
    : hours < 24
      ? `${hours}h ago`
      : `${Math.floor(hours / 24)}d ago`;
}
