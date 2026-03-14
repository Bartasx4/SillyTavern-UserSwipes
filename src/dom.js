import { MESSAGE_SELECTOR } from './constants.js';
import { getContext, getMessage, getMessageElement } from './core.js';
import {
    backfillUserSwipes,
    clearStateAttributes,
    createUserSwipe,
    ensureUserSwipeFields,
    isUserMessage,
    persistCurrentUserSwipe,
    decorateUserSwipeState,
    renderUserSwipeState,
    switchUserSwipe,
} from './user-swipes.js';

const messageLocks = new Set();
let clickHandlerBound = false;

function canHandleUserSwipe(messageId) {
    const context = getContext();
    const message = getMessage(messageId);

    return Number.isInteger(messageId)
        && messageId >= 0
        && isUserMessage(message)
        && !messageLocks.has(messageId)
        && context.swipe.isAllowed();
}

function getSwipeTargetId(message, direction) {
    const currentSwipeId = Number(message.swipe_id ?? 0);
    const total = Array.isArray(message.swipes) ? message.swipes.length : 0;

    if (direction === 'left') {
        if (total <= 1) {
            return null;
        }

        return currentSwipeId > 0 ? currentSwipeId - 1 : total - 1;
    }

    const isLastSwipe = currentSwipeId >= total - 1;
    return isLastSwipe ? total : currentSwipeId + 1;
}

async function withMessageLock(messageId, action) {
    if (messageLocks.has(messageId)) {
        return;
    }

    messageLocks.add(messageId);

    try {
        await action();
    } finally {
        messageLocks.delete(messageId);
    }
}

async function handleSwipeClick(messageId, direction) {
    if (!canHandleUserSwipe(messageId)) {
        return;
    }

    await withMessageLock(messageId, async () => {
        const message = getMessage(messageId);
        ensureUserSwipeFields(message);

        const targetSwipeId = getSwipeTargetId(message, direction);
        if (targetSwipeId === null) {
            return;
        }

        if (direction === 'right' && targetSwipeId === message.swipes.length) {
            createUserSwipe(messageId);
        } else {
            await switchUserSwipe(messageId, targetSwipeId, direction);
        }
    });
}

function onDocumentClick(event) {
    const arrow = event.target.closest('.swipe_left, .swipe_right');
    if (!(arrow instanceof HTMLElement)) {
        return;
    }

    const messageElement = arrow.closest(`${MESSAGE_SELECTOR}[data-user-swipes="enabled"]`);
    if (!(messageElement instanceof HTMLElement)) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const messageId = Number(messageElement.getAttribute('mesid'));
    const direction = arrow.classList.contains('swipe_left') ? 'left' : 'right';
    void handleSwipeClick(messageId, direction);
}

export function bindSwipeClickHandler() {
    if (clickHandlerBound) {
        return;
    }

    document.addEventListener('click', onDocumentClick, true);
    clickHandlerBound = true;
}

export function refreshRenderedUserMessages() {
    backfillUserSwipes();

    const renderedMessageElements = document.querySelectorAll(MESSAGE_SELECTOR);
    for (const messageElement of renderedMessageElements) {
        const messageId = Number(messageElement.getAttribute('mesid'));
        const message = getMessage(messageId);
        if (!isUserMessage(message)) {
            clearStateAttributes($(messageElement));
            continue;
        }

        decorateUserSwipeState(messageId);
    }
}

export function refreshRenderedUserMessage(messageId) {
    const message = getMessage(messageId);
    const messageElement = getMessageElement(messageId);

    if (!messageElement.length) {
        return;
    }

    if (!isUserMessage(message)) {
        clearStateAttributes(messageElement);
        return;
    }

    ensureUserSwipeFields(message);
    decorateUserSwipeState(messageId);
}

export function persistRenderedUserMessage(messageId) {
    const message = getMessage(messageId);
    if (!isUserMessage(message)) {
        return;
    }

    ensureUserSwipeFields(message);
    persistCurrentUserSwipe(messageId);
    decorateUserSwipeState(messageId);
}
