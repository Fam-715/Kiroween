/**
 * Condition text. The condition is ALWAYS carried by text (Requirement 9.6);
 * colour and animation are only extra cues, never the only signal.
 */
export type Condition = "Mint" | "Worn" | "Warped" | "Haunted" | "Dead";

const CONDITION_CLASSES: Record<Condition, string> = {
  Mint: "text-condition-mint",
  Worn: "text-condition-worn",
  Warped: "text-condition-warped",
  Haunted: "text-condition-haunted",
  Dead: "text-condition-dead",
};

export function conditionClassName(condition: Condition): string {
  return CONDITION_CLASSES[condition];
}

export interface ConditionTextProps {
  condition: Condition;
  /** Extra classes for the wrapper span. */
  className?: string;
}

export default function ConditionText({
  condition,
  className = "",
}: ConditionTextProps) {
  return (
    <span
      data-testid="condition-text"
      data-condition={condition}
      className={`font-type uppercase tracking-widest ${CONDITION_CLASSES[condition]} ${className}`}
    >
      {condition}
    </span>
  );
}
