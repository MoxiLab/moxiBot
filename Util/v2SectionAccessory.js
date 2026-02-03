'use strict';

const { ButtonStyle } = require('discord.js');

function resolveButtonData(buttonLike) {
  if (!buttonLike) return null;
  if (typeof buttonLike.toJSON === 'function') return buttonLike.toJSON();
  if (typeof buttonLike === 'object') return buttonLike;
  return null;
}

function setSectionButtonAccessory(sectionBuilder, buttonLike) {
  if (!sectionBuilder) return sectionBuilder;

  // Soporta código legacy si alguna versión trae este método.
  if (typeof sectionBuilder.setButtonAccessory === 'function') {
    return sectionBuilder.setButtonAccessory(buttonLike);
  }

  const data = resolveButtonData(buttonLike);
  if (!data) return sectionBuilder;

  const style = data.style;

  // Discord Components V2 (builders): métodos por estilo.
  try {
    if (style === ButtonStyle.Link && typeof sectionBuilder.setLinkButtonAccessory === 'function') {
      return sectionBuilder.setLinkButtonAccessory(data);
    }
    if (style === ButtonStyle.Primary && typeof sectionBuilder.setPrimaryButtonAccessory === 'function') {
      return sectionBuilder.setPrimaryButtonAccessory(data);
    }
    if (style === ButtonStyle.Secondary && typeof sectionBuilder.setSecondaryButtonAccessory === 'function') {
      return sectionBuilder.setSecondaryButtonAccessory(data);
    }
    if (style === ButtonStyle.Success && typeof sectionBuilder.setSuccessButtonAccessory === 'function') {
      return sectionBuilder.setSuccessButtonAccessory(data);
    }
    if (style === ButtonStyle.Danger && typeof sectionBuilder.setDangerButtonAccessory === 'function') {
      return sectionBuilder.setDangerButtonAccessory(data);
    }
  } catch {
    // ignore and fall back below
  }

  // Fallback sensato: secundario si existe.
  if (typeof sectionBuilder.setSecondaryButtonAccessory === 'function') {
    return sectionBuilder.setSecondaryButtonAccessory({ ...data, style: ButtonStyle.Secondary });
  }

  return sectionBuilder;
}

module.exports = {
  setSectionButtonAccessory,
};
