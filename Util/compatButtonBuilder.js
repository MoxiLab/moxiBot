'use strict';

const {
  ButtonStyle,
  LinkButtonBuilder,
  PrimaryButtonBuilder,
  SecondaryButtonBuilder,
  SuccessButtonBuilder,
  DangerButtonBuilder,
} = require('discord.js');

const { toComponentEmoji } = require('./discordEmoji');

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

class ButtonBuilder {
  constructor() {
    this._style = ButtonStyle.Secondary;
    this._customId = undefined;
    this._label = undefined;
    this._disabled = undefined;
    this._emoji = undefined;
    this._url = undefined;
  }

  setStyle(style) {
    this._style = style;
    return this;
  }

  setCustomId(customId) {
    this._customId = String(customId);
    return this;
  }

  setLabel(label) {
    this._label = String(label);
    return this;
  }

  setDisabled(disabled) {
    this._disabled = Boolean(disabled);
    return this;
  }

  setEmoji(emoji) {
    this._emoji = toComponentEmoji(emoji);
    return this;
  }

  setURL(url) {
    this._url = String(url);
    return this;
  }

  toJSON() {
    const style = this._style;
    const styleKey = typeof style === 'string' ? style.trim().toLowerCase() : null;
    const isLink = style === ButtonStyle.Link || styleKey === 'link';
    const isPrimary = style === ButtonStyle.Primary || styleKey === 'primary';
    const isSecondary = style === ButtonStyle.Secondary || styleKey === 'secondary';
    const isSuccess = style === ButtonStyle.Success || styleKey === 'success';
    const isDanger = style === ButtonStyle.Danger || styleKey === 'danger';

    let builder;
    if (isLink) {
      builder = new LinkButtonBuilder();
      if (isNonEmptyString(this._url)) builder.setURL(this._url);
    } else if (isPrimary) {
      builder = new PrimaryButtonBuilder();
    } else if (isSuccess) {
      builder = new SuccessButtonBuilder();
    } else if (isDanger) {
      builder = new DangerButtonBuilder();
    } else if (isSecondary) {
      builder = new SecondaryButtonBuilder();
    } else {
      builder = new SecondaryButtonBuilder();
    }

    if (!isLink && isNonEmptyString(this._customId)) {
      builder.setCustomId(this._customId);
    }

    if (isNonEmptyString(this._label)) builder.setLabel(this._label);
    if (typeof this._disabled === 'boolean') builder.setDisabled(this._disabled);
    if (this._emoji) builder.setEmoji(this._emoji);

    return builder.toJSON();
  }
}

module.exports = {
  ButtonBuilder,
  ButtonStyle,
};
