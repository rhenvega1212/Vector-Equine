export type AskSourceRef =
  | { kind: "transcript"; atSec: number }
  | { kind: "moment"; atSec: number }
  | { kind: "measurement"; id: string }
  | { kind: "ride"; rideId: string };

export type AskSource = {
  label: string;
  text: string;
  ref: AskSourceRef;
};

export type AskTurn = {
  id: string;
  question: string;
  answer: string;
  askedByVoice: boolean;
  sources: AskSource[];
  createdAt: string;
};

export type AskExample = {
  text: string;
};
