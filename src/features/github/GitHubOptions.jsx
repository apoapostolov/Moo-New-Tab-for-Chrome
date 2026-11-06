import { Header, Group, Row, Content } from 'components/Layout/Settings';
import WidgetSurface from 'components/Form/Settings/WidgetSurface/WidgetSurface';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { uiText } from 'lib/translations';
import { OptionSelect, OptionInput, OptionToggle, numberChoices } from '../widgetKit/WidgetKit';
import { validLogin, validRepository, repositories, VIEWS } from './githubStore';

export default function GitHubOptions() {
  useTranslationVersion();
  return (
    <>
      <Header title="GitHub" setting="githubEnabled" category="widgets" visibilityToggle />
      <Group>
        <WidgetSurface setting="surfaceGithub" category="github" />
        <OptionSelect
          category="github"
          name="githubTitleDestination"
          title="Open GitHub title"
          items={[
            { value: 'home', text: 'Homepage' },
            { value: 'notifications', text: 'Notifications' },
            { value: 'pulls', text: uiText('github_pulls') },
            { value: 'issues', text: uiText('github_issues') },
            { value: 'explore', text: 'Explore' },
            { value: 'profile', text: 'Your profile' },
            { value: 'repositories', text: uiText('github_repositories') },
          ]}
        />
        <OptionInput
          category="github"
          name="githubUsername"
          title={uiText('github_username')}
          hint={uiText('github_username_hint')}
          maxLength={39}
          validate={(value) => !value || validLogin(value)}
        />
        <OptionInput
          category="github"
          name="githubToken"
          title={uiText('github_token')}
          hint={uiText('github_token_hint')}
          type="password"
          maxLength={500}
        />
        <Row>
          <Content
            subtitle={
              <a
                href="https://github.com/settings/personal-access-tokens"
                target="_blank"
                rel="noopener noreferrer"
              >
                {uiText('github_create_token')}
              </a>
            }
          />
        </Row>
        <OptionSelect
          category="github"
          name="githubRefresh"
          title={uiText('widget_refresh_interval')}
          hint={uiText('github_rate_hint')}
          items={numberChoices([5, 15, 30, 60], uiText('widget_minutes'))}
        />
        <OptionSelect
          category="github"
          name="githubLimit"
          title={uiText('widget_item_limit')}
          items={numberChoices([3, 6, 10, 15, 20])}
        />
        <OptionToggle
          category="github"
          name="githubShowUpdated"
          title={uiText('github_show_updated')}
        />
      </Group>
      <Group>
        <Row>
          <Content title={uiText('github_views')} subtitle={uiText('github_views_hint')} />
        </Row>
        {VIEWS.map((view) => (
          <OptionToggle
            key={view}
            category="github"
            name={`githubShow${view[0].toUpperCase()}${view.slice(1)}`}
            title={uiText(`github_${view}`)}
          />
        ))}
      </Group>
      <Group>
        <Row>
          <Content title={uiText('github_filters')} subtitle={uiText('github_filters_hint')} />
        </Row>
        <OptionInput
          category="github"
          name="githubRepositories"
          title={uiText('github_repositories')}
          hint={uiText('github_repositories_hint')}
          multiline
          maxLength={2200}
          placeholder="owner/repository"
          validate={(value) => {
            const repos = repositories(value);
            return repos.length <= 10 && repos.every(validRepository);
          }}
        />
        <OptionInput
          category="github"
          name="githubOrganization"
          title={uiText('github_organization')}
          maxLength={39}
          validate={(value) => !value || validLogin(value)}
        />
        <OptionSelect
          category="github"
          name="githubState"
          title={uiText('github_issue_state')}
          items={['open', 'closed', 'all'].map((value) => ({
            value,
            text: uiText(`github_filter_${value}`),
          }))}
        />
        <OptionSelect
          category="github"
          name="githubSort"
          title={uiText('widget_sort')}
          items={['updated', 'created', 'comments'].map((value) => ({
            value,
            text: uiText(`github_sort_${value}`),
          }))}
        />
        <OptionToggle
          category="github"
          name="githubIncludeDrafts"
          title={uiText('github_include_drafts')}
        />
        <OptionInput
          category="github"
          name="githubExtraQuery"
          title={uiText('github_extra_query')}
          hint={uiText('github_extra_query_hint')}
          multiline
          maxLength={1000}
          placeholder="label:bug -label:blocked"
        />
      </Group>
      <Group>
        <Row>
          <Content title={uiText('github_actions')} subtitle={uiText('github_actions_hint')} />
        </Row>
        <OptionInput
          category="github"
          name="githubActionsBranch"
          title={uiText('github_branch')}
          hint={uiText('github_branch_hint')}
          maxLength={200}
        />
        <OptionSelect
          category="github"
          name="githubActionsStatus"
          title={uiText('github_workflow_status')}
          items={['failure', 'in_progress', 'all'].map((value) => ({
            value,
            text: uiText(`github_filter_${value}`),
          }))}
        />
        <Row>
          <Content subtitle={uiText('github_read_only')} />
        </Row>
      </Group>
    </>
  );
}
