import { useState } from 'react';
import { WidgetShell } from 'features/widgetKit/WidgetKit';
import useRemoteWidget from 'features/widgetKit/useRemoteWidget';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { loadKnowledge } from './knowledgeStore';
import './knowledge.scss';

const SETTINGS = /^(knowledge|offlineMode$|profileRevision$)/;
function KnowledgeImage({ article, offline }) {
  const [failed, setFailed] = useState(false);
  if (!article.image || failed || offline) return null;
  return (
    <figure className={`knowledgeFigure ${article.source === 'commons' ? 'knowledgeCommons' : ''}`}>
      <a
        href={article.imagePage || article.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={uiText('knowledge_image_details')}
      >
        <img
          src={article.image}
          alt={article.imageTitle || article.title}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
        />
      </a>
      <figcaption>
        <a
          href={article.imagePage || article.url}
          target="_blank"
          rel="noopener noreferrer"
          title={[article.credit, article.license].filter(Boolean).join(' · ')}
        >
          {[article.credit, article.license].filter(Boolean).join(' · ') ||
            uiText('knowledge_image_details')}
        </a>
      </figcaption>
    </figure>
  );
}

export default function Knowledge() {
  useTranslationVersion();
  const state = useRemoteWidget('knowledge', SETTINGS, loadKnowledge, 0.5, {
    preservePending: true,
  });
  const article = state.data?.article;
  const offline = localStorage.getItem('offlineMode') === 'true';
  const code = ['offline', 'empty', 'rate'].includes(state.error?.message)
    ? state.error.message
    : 'network';
  return (
    <WidgetShell
      widget="knowledge"
      title={uiText('knowledge_title')}
      className="knowledgeWidget"
      loading={state.loading}
      actions={
        article ? (
          <div className="knowledgeEyebrow">
            <span>{article.source === 'commons' ? 'Wikimedia Commons' : 'Wikipedia'}</span>
            {article.subject && (
              <span className="knowledgeSubject" title={article.subject}>
                {article.subject}
              </span>
            )}
          </div>
        ) : null
      }
      onRefresh={state.refresh}
      error={state.error ? uiText(`knowledge_error_${code}`) : null}
    >
      {!article ? (
        <p className="wkEmpty" role="status">
          {uiText(state.loading ? 'knowledge_loading' : 'knowledge_empty')}
        </p>
      ) : (
        <>
          <h3 className="knowledgeTitle">
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              {article.title}
            </a>
          </h3>
          <KnowledgeImage key={article.id} article={article} offline={offline} />
          {article.summary && <p className="knowledgeSummary">{article.summary}</p>}
          <footer className="knowledgeFooter">
            <a href={article.url} target="_blank" rel="noopener noreferrer">
              {uiText('knowledge_read')} <span aria-hidden="true">↗</span>
            </a>
            {article.source === 'wikipedia' && (
              <a
                href="https://en.wikipedia.org/wiki/Wikipedia:Copyrights"
                target="_blank"
                rel="noopener noreferrer"
                className="knowledgeLicense"
              >
                CC BY-SA
              </a>
            )}
          </footer>
          {state.data.stale && (
            <p className="knowledgeStatus" role="status">
              {uiText('knowledge_cached')}
            </p>
          )}
          {state.data.cacheWarning && (
            <p className="knowledgeStatus" role="status">
              {uiText('knowledge_cache_warning')}
            </p>
          )}
        </>
      )}
    </WidgetShell>
  );
}
