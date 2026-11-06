import { uiText } from 'lib/translations';
import { useTranslationVersion } from 'contexts/TranslationContext';
import variables from 'config/variables';
import { memo, useState, useEffect, useCallback, useRef } from 'react';
import { MdSource, MdOutlineAutoAwesome } from 'react-icons/md';
import Modal from 'react-modal';
import EventBus from 'utils/eventbus';

import { Header } from 'components/Layout/Settings';
import { Dropdown } from 'components/Form/Settings';

import FallbackOptions from './FallbackOptions';
import ColourSettings from './Colour';
import CustomSettings from './Custom';
import APISettings from './sections/APISettings';
import MixkitPermissionModal from './MixkitPermissionModal';
import DisplaySettings from './sections/DisplaySettings';
import EffectsSettings from './sections/EffectsSettings';
import SourceSection from './sections/SourceSection';
import NavigationCard from './sections/NavigationCard';
import { grantMixkit, mixkitAccess } from '../api/mixkit';

import {
  getBackgroundOptionItems,
  getApiForBackgroundType,
  isApiBackgroundType,
  normalizeBackgroundType,
} from './optionTypes';

const BackgroundOptions = memo(({ currentSubSection, onSubSectionChange, sectionName }) => {
  useTranslationVersion();
  const [backgroundType, setBackgroundType] = useState(() => {
    const stored = localStorage.getItem('backgroundType') || 'api_unsplash';
    const normalized = normalizeBackgroundType(stored);
    if (normalized !== stored) localStorage.setItem('backgroundType', normalized);
    return normalized;
  });
  const [backgroundFilter, setBackgroundFilter] = useState(
    localStorage.getItem('backgroundFilter') || 'none',
  );
  const [fallbackType, setFallbackType] = useState(
    localStorage.getItem('fallbackBackgroundType') || 'none',
  );
  const [backgroundCategories, setBackgroundCategories] = useState([
    variables.getMessage(
      navigator.onLine === false || localStorage.getItem('offlineMode') === 'true'
        ? 'modals.update.offline.title'
        : 'modals.main.loading',
    ),
  ]);
  const [unsplashTopics, setUnsplashTopics] = useState(null);
  const [marketplaceEnabled] = useState(localStorage.getItem('photo_packs'));
  const [mixkitPermissionModal, setMixkitPermissionModal] = useState(false);

  const controllerRef = useRef(null);
  const mixkitPromptCheckRef = useRef(0);
  const subSectionRef = useRef(currentSubSection);

  useEffect(() => {
    subSectionRef.current = currentSubSection;
  }, [currentSubSection]);

  // A new source invalidates the queue prefetched for the previous API.
  useEffect(() => {
    if (!isApiBackgroundType(backgroundType)) return;

    const api = getApiForBackgroundType(backgroundType);
    if (localStorage.getItem('backgroundAPI') !== api) {
      localStorage.setItem('nextImage', null);
      localStorage.removeItem('imageQueue');
      localStorage.setItem('backgroundAPI', api);
    }
  }, [backgroundType]);

  const getBackgroundCategories = useCallback(async () => {
    const data = await (
      await fetch(variables.constants.API_URL + '/images/categories', {
        signal: controllerRef.current.signal,
      })
    ).json();

    if (controllerRef.current.signal.aborted === true) {
      return;
    }

    setBackgroundCategories(data);
  }, []);

  const getUnsplashTopics = useCallback(async () => {
    try {
      const response = await fetch(variables.constants.API_URL + '/images/unsplash/topics', {
        signal: controllerRef.current.signal,
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();

      if (controllerRef.current.signal.aborted === true || !Array.isArray(data)) {
        return;
      }

      setUnsplashTopics(
        data
          .filter((topic) => topic?.id && topic?.title)
          .map((topic) => ({ name: topic.id, label: topic.title })),
      );
    } catch {
      // Leave the picker empty when the topic list cannot be fetched.
    }
  }, []);

  useEffect(() => {
    controllerRef.current = new AbortController();

    if (navigator.onLine === false || localStorage.getItem('offlineMode') === 'true') {
      return;
    }

    getBackgroundCategories().catch((error) => {
      if (error.name !== 'AbortError') setBackgroundCategories([]);
    });
    getUnsplashTopics();

    return () => {
      controllerRef.current.abort();
    };
  }, [getBackgroundCategories, getUnsplashTopics]);

  const handleTypeChange = useCallback(
    (value) => {
      const requestId = ++mixkitPromptCheckRef.current;
      localStorage.removeItem('imageQueue');
      setBackgroundType(value);

      if (isApiBackgroundType(value)) {
        localStorage.setItem('nextImage', null);
        localStorage.setItem('backgroundAPI', getApiForBackgroundType(value));
      }

      if (value === 'custom') {
        EventBus.emit('refresh', 'background');
      }

      // The provider settings page has its own inline permission action. The main
      // Background settings selector needs a popup because that action is not visible there.
      if (value === 'api_mixkit' && !currentSubSection) {
        mixkitAccess().then((access) => {
          if (
            requestId === mixkitPromptCheckRef.current &&
            !subSectionRef.current &&
            access !== 'granted'
          ) {
            setMixkitPermissionModal(true);
          }
        });
      }
    },
    [currentSubSection],
  );

  const allowMixkitFromModal = async () => {
    if (await grantMixkit()) setMixkitPermissionModal(false);
  };

  const handleFallbackChange = (value) => {
    localStorage.removeItem('imageQueue');
    localStorage.removeItem('videoQueue');
    setFallbackType(value);
  };

  const getBackgroundSettings = (type = backgroundType, fallback = false) => {
    switch (type) {
      case 'none':
        return null;
      case 'custom':
        return <CustomSettings />;
      case 'colour':
        return fallback ? (
          <ColourSettings setting="fallbackBackgroundColour" category="backgroundsource" />
        ) : (
          <ColourSettings />
        );
      case 'random_colour':
      case 'random_gradient':
        return null;
      default:
        break;
    }

    if (
      localStorage.getItem('photo_packs') &&
      type !== 'custom' &&
      type !== 'colour' &&
      !isApiBackgroundType(type)
    ) {
      return null;
    }

    return (
      <APISettings
        key={`${fallback ? 'fallback' : 'primary'}:${type}`}
        backgroundAPI={getApiForBackgroundType(type)}
        backgroundCategories={backgroundCategories}
        unsplashTopics={unsplashTopics}
      />
    );
  };

  const usingImage =
    backgroundType !== 'colour' &&
    backgroundType !== 'random_colour' &&
    backgroundType !== 'random_gradient';

  const showEffects =
    isApiBackgroundType(backgroundType) || backgroundType === 'custom' || marketplaceEnabled;

  const getHeader = () => {
    if (currentSubSection === 'fallback') {
      return (
        <Header
          title={variables.getMessage('modals.main.settings.sections.background.title')}
          secondaryTitle={uiText('fallback_source')}
          goBack={() => onSubSectionChange(null, sectionName)}
        />
      );
    }
    if (currentSubSection === 'effects') {
      return (
        <Header
          title={variables.getMessage('modals.main.settings.sections.background.title')}
          secondaryTitle={variables.getMessage(
            'modals.main.settings.sections.background.effects.title',
          )}
          goBack={() => onSubSectionChange(null, sectionName)}
        />
      );
    }

    if (currentSubSection === 'source') {
      return (
        <Header
          title={variables.getMessage('modals.main.settings.sections.background.title')}
          secondaryTitle={variables.getMessage(
            'modals.main.settings.sections.background.source.title',
          )}
          goBack={() => onSubSectionChange(null, sectionName)}
        />
      );
    }

    return (
      <Header
        title={variables.getMessage('modals.main.settings.sections.background.title')}
        setting="background"
        category="background"
        element="#backgroundImage"
      />
    );
  };

  return (
    <>
      {getHeader()}

      {!currentSubSection && (
        <>
          <NavigationCard
            className="backgroundProviderCard"
            icon={MdSource}
            title={variables.getMessage('modals.main.settings.sections.background.source.title')}
            subtitle={variables.getMessage(
              'modals.main.settings.sections.background.source.subtitle',
            )}
            onClick={() => onSubSectionChange('source', sectionName)}
            action={
              <Dropdown
                label={variables.getMessage('modals.main.settings.sections.background.type.title')}
                name="backgroundType"
                onChange={handleTypeChange}
                category="background"
                items={getBackgroundOptionItems(marketplaceEnabled)}
              />
            }
          />

          <FallbackOptions
            onTypeChange={handleFallbackChange}
            onOpen={() => onSubSectionChange('fallback', sectionName)}
          />
          {showEffects && (
            <NavigationCard
              icon={MdOutlineAutoAwesome}
              title={variables.getMessage('modals.main.settings.sections.background.effects.title')}
              subtitle={variables.getMessage(
                'modals.main.settings.sections.background.effects.subtitle',
              )}
              onClick={() => onSubSectionChange('effects', sectionName)}
            />
          )}
        </>
      )}

      {!currentSubSection && showEffects && <DisplaySettings usingImage={usingImage} />}

      {currentSubSection === 'source' && (
        <>
          <SourceSection
            backgroundType={backgroundType}
            marketplaceEnabled={marketplaceEnabled}
            onTypeChange={handleTypeChange}
          />
          {getBackgroundSettings()}
        </>
      )}

      {showEffects && currentSubSection === 'effects' && (
        <EffectsSettings
          backgroundFilter={backgroundFilter}
          onFilterChange={(value) => setBackgroundFilter(value)}
        />
      )}
      {currentSubSection === 'fallback' && (
        <>
          <FallbackOptions onTypeChange={handleFallbackChange} />
          {getBackgroundSettings(fallbackType, true)}
        </>
      )}

      <Modal
        closeTimeoutMS={100}
        onRequestClose={() => setMixkitPermissionModal(false)}
        isOpen={mixkitPermissionModal}
        className="Modal resetmodal mainModal"
        overlayClassName="Overlay resetoverlay"
        ariaHideApp={true}
      >
        <MixkitPermissionModal
          onAllow={allowMixkitFromModal}
          onClose={() => setMixkitPermissionModal(false)}
        />
      </Modal>
    </>
  );
});

BackgroundOptions.displayName = 'BackgroundOptions';

export { BackgroundOptions as default, BackgroundOptions };
