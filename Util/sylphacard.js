// Utilidad para generar cards con sylphacard
const { Mini, Greeting, GreetingV2 } = require('sylphacard');





// Mini = estilo compacto
async function buildSylphaCardMini({ thumbnailImage, backgroundColor = '#181818', menuColor = '#1db954', progress = 0, progressColor = '#fff', progressBarColor = '#1db954', paused = false }) {
  return await Mini({
    thumbnailImage,
    backgroundColor,
    menuColor,
    progress,
    progressColor,
    progressBarColor,
    paused
  });
}

// GreetingV2 = estilo bienvenida/despedida
async function buildSylphaGreetingV2({
  type = 'welcome',
  username,
  message,
  memberCount,
  joinedAt,
  avatarImage,
  backgroundImage,
  backgroundColor,
  textColor,
  accentColor,
  imageDarkness,
}) {
  return await GreetingV2({
    type,
    username,
    message,
    memberCount,
    joinedAt,
    avatarImage,
    backgroundImage,
    backgroundColor,
    textColor,
    accentColor,
    imageDarkness,
  });
}

// Greeting = estilo clásico de bienvenida/despedida
async function buildSylphaGreeting({
  type = 'welcome',
  username,
  message,
  memberCount,
  avatarImage,
  backgroundImage,
  backgroundColor,
  primaryColor,
  textColor,
  secondaryTextColor,
  accentColor,
  imageDarkness,
}) {
  return await Greeting({
    type,
    username,
    message,
    memberCount,
    avatarImage,
    backgroundImage,
    backgroundColor,
    primaryColor,
    textColor,
    secondaryTextColor,
    accentColor,
    imageDarkness,
  });
}

module.exports = { buildSylphaCardMini, buildSylphaGreetingV2, buildSylphaGreeting };