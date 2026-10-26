import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Preset dropdown options for the Variant (RAM/Storage) and Colour fields.
export const VARIANT_OPTIONS = [
  "4GB / 64GB",
  "6GB / 128GB",
  "8GB / 128GB",
  "8GB / 256GB",
  "12GB / 256GB",
  "16GB / 512GB",
];

export const COLOUR_OPTIONS = [
  "Black",
  "White",
  "Blue",
  "Silver",
  "Gold",
  "Green",
  "Red",
  "Purple",
  "Pink",
  "Grey",
  "Orange",
  "Yellow",
  "Titanium",
];

// Sentinel Select values (Radix Select does not allow an empty item value).
export const NONE_VALUE = "__none__";
export const CUSTOM_VALUE = "__custom__";

export interface Choice {
  select: string;
  custom: string;
}

export const emptyChoice = (): Choice => ({ select: NONE_VALUE, custom: "" });

/** Build the dropdown state from a value stored in the database. */
export const choiceFromStored = (stored: string | null | undefined, options: string[]): Choice => {
  const value = (stored || "").trim();
  if (!value) return emptyChoice();
  if (options.includes(value)) return { select: value, custom: value };
  return { select: CUSTOM_VALUE, custom: value };
};

const CUSTOM_PATTERN = /^[A-Za-z0-9 /]+$/;

/** Resolve the dropdown state to the value that gets saved ("" when unset). */
export const resolveChoice = (
  choice: Choice,
  options: string[],
  label: string
): { value: string; error?: string } => {
  if (choice.select === NONE_VALUE) return { value: "" };
  if (choice.select !== CUSTOM_VALUE) return { value: choice.select };
  const text = choice.custom.trim();
  if (!text) return { value: "", error: `Type a ${label} or choose "None"` };
  if (text.length > 30) return { value: "", error: `${label} must be 30 characters or fewer` };
  if (!CUSTOM_PATTERN.test(text)) {
    return { value: "", error: `${label} can only use letters, numbers, spaces and /` };
  }
  return { value: text };
};

interface ChoiceFieldProps {
  id: string;
  label: string;
  placeholder: string;
  customPlaceholder: string;
  options: string[];
  choice: Choice;
  onChange: (next: Choice) => void;
}

const ChoiceField = ({
  id,
  label,
  placeholder,
  customPlaceholder,
  options,
  choice,
  onChange,
}: ChoiceFieldProps) => (
  <div>
    <Label htmlFor={id}>{label}</Label>
    <Select
      value={choice.select}
      onValueChange={(value) =>
        onChange({
          select: value,
          custom: value === CUSTOM_VALUE ? choice.custom : value,
        })
      }
    >
      <SelectTrigger id={id}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE_VALUE}>None</SelectItem>
        {options.map((option) => (
          <SelectItem key={option} value={option}>
            {option}
          </SelectItem>
        ))}
        <SelectItem value={CUSTOM_VALUE}>Custom...</SelectItem>
      </SelectContent>
    </Select>
    {choice.select === CUSTOM_VALUE && (
      <Input
        className="mt-2"
        maxLength={30}
        placeholder={customPlaceholder}
        value={choice.custom}
        onChange={(e) => onChange({ ...choice, custom: e.target.value })}
      />
    )}
  </div>
);

interface VariantColourFieldsProps {
  variant: Choice;
  colour: Choice;
  onVariantChange: (next: Choice) => void;
  onColourChange: (next: Choice) => void;
}

const VariantColourFields = ({
  variant,
  colour,
  onVariantChange,
  onColourChange,
}: VariantColourFieldsProps) => (
  <>
    <ChoiceField
      id="variant"
      label="Variant (RAM / Storage)"
      placeholder="Select variant"
      customPlaceholder="e.g. 6GB / 128GB"
      options={VARIANT_OPTIONS}
      choice={variant}
      onChange={onVariantChange}
    />
    <ChoiceField
      id="colour"
      label="Colour"
      placeholder="Select colour"
      customPlaceholder="e.g. Midnight Blue"
      options={COLOUR_OPTIONS}
      choice={colour}
      onChange={onColourChange}
    />
  </>
);

export default VariantColourFields;
