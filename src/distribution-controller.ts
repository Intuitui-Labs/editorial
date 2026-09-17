import type { DistributionChannel } from './domain.js';

export interface EditorialArticleInput {
  title: string;
  url: string;
  summary?: string;
  author?: string;
  topics?: string[];
  publication?: string;
  language?: string;
  format?: string;
}

export interface DistributionControllerConfig {
  article: EditorialArticleInput;
  defaultChannel?: DistributionChannel;
  channels?: DistributionChannel[];
  utmCampaign?: string;
  onDispatch?: (channel: DistributionChannel, text: string) => Promise<{ status: string; externalUrl?: string }>;
}

export interface DistributionControllerState {
  activeChannel: DistributionChannel;
  postText: string;
  charCount: number;
  maxChars?: number;
  isReviewed: boolean;
  canDispatch: boolean;
  isDispatching: boolean;
  dispatchSuccess: boolean;
  lastError?: string;
  availableChannels: DistributionChannel[];
}

/**
 * Headless controller for social media distribution & review workflows.
 * Framework-agnostic: can be bound to React, Svelte, Vue, Solid, Astro, or plain DOM.
 */
export class DistributionController {
  private config: DistributionControllerConfig;
  private state: DistributionControllerState;
  private listeners = new Set<(state: DistributionControllerState) => void>();

  constructor(config: DistributionControllerConfig) {
    this.config = config;
    const channels = config.channels ?? ['linkedin', 'postiz', 'meta', 'medium', 'substack'];
    const active = config.defaultChannel ?? channels[0] ?? 'linkedin';
    const initialText = this.buildTemplate(active);

    this.state = {
      activeChannel: active,
      postText: initialText,
      charCount: initialText.length,
      maxChars: this.getChannelLimit(active),
      isReviewed: false,
      canDispatch: false,
      isDispatching: false,
      dispatchSuccess: false,
      availableChannels: channels,
    };
  }

  public getState(): Readonly<DistributionControllerState> {
    return this.state;
  }

  public subscribe(listener: (state: DistributionControllerState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  public setChannel(channel: DistributionChannel): void {
    if (this.state.activeChannel === channel) return;
    const text = this.buildTemplate(channel);
    this.state = {
      ...this.state,
      activeChannel: channel,
      postText: text,
      charCount: text.length,
      maxChars: this.getChannelLimit(channel),
      canDispatch: this.state.isReviewed && text.trim().length > 0,
      dispatchSuccess: false,
      lastError: undefined,
    };
    this.notify();
  }

  public setPostText(text: string): void {
    this.state = {
      ...this.state,
      postText: text,
      charCount: text.length,
      canDispatch: this.state.isReviewed && text.trim().length > 0,
    };
    this.notify();
  }

  public setReviewed(isReviewed: boolean): void {
    this.state = {
      ...this.state,
      isReviewed,
      canDispatch: isReviewed && this.state.postText.trim().length > 0,
    };
    this.notify();
  }

  public resetToTemplate(): void {
    const text = this.buildTemplate(this.state.activeChannel);
    this.setPostText(text);
  }

  public async copyToClipboard(): Promise<boolean> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(this.state.postText);
      return true;
    }
    return false;
  }

  public async dispatch(): Promise<{ status: string; externalUrl?: string }> {
    if (!this.state.canDispatch || this.state.isDispatching) {
      throw new Error('Cannot dispatch: reviewer gate not approved or post text empty.');
    }

    this.state = {
      ...this.state,
      isDispatching: true,
      lastError: undefined,
      dispatchSuccess: false,
    };
    this.notify();

    try {
      let result: { status: string; externalUrl?: string } = { status: 'success' };
      if (this.config.onDispatch) {
        result = await this.config.onDispatch(this.state.activeChannel, this.state.postText);
      } else {
        await this.copyToClipboard();
        result = { status: 'dispatched' };
      }

      this.state = {
        ...this.state,
        isDispatching: false,
        dispatchSuccess: true,
      };
      this.notify();
      return result;
    } catch (err: any) {
      this.state = {
        ...this.state,
        isDispatching: false,
        lastError: err?.message || 'Dispatch failed',
      };
      this.notify();
      throw err;
    }
  }

  public buildTemplate(channel: DistributionChannel): string {
    const { title, summary = '', url, topics = [] } = this.config.article;
    const campaign = encodeURIComponent(this.config.utmCampaign ?? 'editorial-syndication');
    const hashtags = topics.map(t => '#' + t.replace(/[^a-zA-Z0-9]/g, '')).join(' ');

    switch (channel) {
      case 'linkedin':
        return [title, summary, hashtags, url + '?utm_source=linkedin&utm_medium=social&utm_campaign=' + campaign].filter(Boolean).join('\n\n');

      case 'postiz':
        return [title, summary, url + '?utm_source=postiz&utm_campaign=' + campaign].filter(Boolean).join('\n\n');

      case 'meta': {
        const excerpt = summary.length > 180 ? summary.slice(0, 177) + '...' : summary;
        return [title, excerpt, url + '?utm_source=meta&utm_medium=social'].filter(Boolean).join('\n\n');
      }

      case 'medium':
        return [
          '--- Canonical Piece: ' + title + ' ---',
          'Summary:\n' + summary,
          'Original Publication:\n' + url + '?utm_source=medium&utm_medium=syndication&utm_campaign=' + campaign,
          hashtags ? 'Tags: ' + hashtags : '',
        ].filter(Boolean).join('\n\n');

      case 'substack':
        return [
          'Notes Dispatch: ' + title,
          summary,
          'Read full piece: ' + url + '?utm_source=substack&utm_medium=notes',
        ].filter(Boolean).join('\n\n');

      default:
        return [title, summary, url].filter(Boolean).join('\n\n');
    }
  }

  private getChannelLimit(channel: DistributionChannel): number | undefined {
    switch (channel) {
      case 'meta':
        return 280;
      case 'linkedin':
        return 3000;
      default:
        return undefined;
    }
  }
}
