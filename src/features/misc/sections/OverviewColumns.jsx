import { MdViewStream, MdViewColumn } from 'react-icons/md';
import { uiText } from 'lib/translations';
export default function OverviewColumns({ count, onSelect, disabled }) {
  return (
    <div
      className="overviewColumnsSwitch"
      role="group"
      aria-label={uiText('center_widget_columns')}
    >
      {[
        ['1', MdViewStream, 'center_one_column'],
        ['2', MdViewColumn, 'center_two_columns'],
      ].map(([value, Icon, label]) => (
        <button
          key={value}
          type="button"
          aria-label={uiText(label)}
          title={uiText(label)}
          aria-pressed={count === value}
          disabled={disabled}
          onClick={() => onSelect(value)}
        >
          <Icon aria-hidden="true" />
          <span aria-hidden="true">{value}</span>
        </button>
      ))}
    </div>
  );
}
