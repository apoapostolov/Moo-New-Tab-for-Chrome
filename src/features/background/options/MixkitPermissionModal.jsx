import { useTranslationVersion } from 'contexts/TranslationContext';
import variables from 'config/variables';
import { MdClose } from 'react-icons/md';
import { Button } from 'components/Elements';

const MixkitPermissionModal = ({ onAllow, onClose }) => {
  useTranslationVersion();
  const base = 'modals.main.settings.sections.background.mixkit';

  return (
    <div className="smallModal">
      <div className="shareHeader">
        <span className="title">{variables.getMessage(`${base}.title`)}</span>
        <button
          type="button"
          className="closeModal"
          aria-label={variables.getMessage('modals.main.settings.buttons.close')}
          onClick={onClose}
        >
          <MdClose />
        </button>
      </div>
      <p className="subtitle">{variables.getMessage(`${base}.subtitle`)}</p>
      <div className="resetFooter">
        <Button type="settings" onClick={onAllow} label={variables.getMessage(`${base}.allow`)} />
      </div>
    </div>
  );
};

export default MixkitPermissionModal;
