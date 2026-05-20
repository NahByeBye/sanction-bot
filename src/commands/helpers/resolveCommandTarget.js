const REPLY_TARGET_TOKEN = '.';

const TARGET_ERRORS = {
  NO_ID: 'Aucun id fourni.',
  INVALID_ID: 'Id invalide.'
};

async function fetchReplyAuthorId(message) {
  if (!message.reference?.messageId) {
    return null;
  }
  try {
    const referenced = await message.fetchReference();
    if (!referenced?.author || referenced.author.bot) {
      return null;
    }
    return referenced.author.id;
  } catch {
    return null;
  }
}

/**
 * Résout la cible d'une commande : mention, ID, « . » (réponse) ou auteur du message cité.
 * Modifie args en place (shift du token utilisateur).
 */
async function resolveCommandTarget(message, args, registry, options = {}) {
  const { allowReplyWithoutToken = true } = options;
  const replyUserId = await fetchReplyAuthorId(message);

  if (args[0] === REPLY_TARGET_TOKEN) {
    args.shift();
    if (!replyUserId) {
      return { error: TARGET_ERRORS.NO_ID };
    }
    return { userId: replyUserId, viaReply: true };
  }

  if (allowReplyWithoutToken && args.length === 0 && replyUserId) {
    return { userId: replyUserId, viaReply: true };
  }

  const token = args.shift();
  if (!token) {
    return { error: TARGET_ERRORS.NO_ID };
  }

  const userId = registry.extractUserId(token);
  if (!userId) {
    return { error: TARGET_ERRORS.INVALID_ID };
  }

  return { userId, viaReply: false };
}

module.exports = {
  REPLY_TARGET_TOKEN,
  TARGET_ERRORS,
  fetchReplyAuthorId,
  resolveCommandTarget
};
