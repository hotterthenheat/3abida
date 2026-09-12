import FilterTabs from './FilterTabs';

interface SegmentedControlProps<V extends string> {
  options: readonly { value: V; label: string }[];
  value: V;
  onChange: (value: V) => void;
  ariaLabel?: string;
}

/** Alias of FilterTabs — the boxed segmented look was retired (2026-07-19,
    Noah: "too common"). Every legacy call site now renders the soft rail +
    sliding white pill. New code should import FilterTabs directly. */
const SegmentedControl = <V extends string>(props: SegmentedControlProps<V>) => <FilterTabs {...props} />;

export default SegmentedControl;
