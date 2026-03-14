import { MODULE_NAME } from './constants.js';
import { getContext } from './core.js';
import {
    bindSwipeClickHandler,
    persistRenderedUserMessage,
    refreshRenderedUserMessage,
    refreshRenderedUserMessages,
} from './dom.js';
import { ensureUserSwipeFields, isUserMessage } from './user-swipes.js';

let initialized = false;

function registerEventHandlers() {
    const context = getContext();
    const { eventSource, eventTypes } = context;

    eventSource.on(eventTypes.APP_READY, () => {
        refreshRenderedUserMessages();
    });

    eventSource.on(eventTypes.CHAT_CHANGED, () => {
        requestAnimationFrame(() => refreshRenderedUserMessages());
    });

    eventSource.on(eventTypes.MORE_MESSAGES_LOADED, () => {
        requestAnimationFrame(() => refreshRenderedUserMessages());
    });

    eventSource.on(eventTypes.MESSAGE_SENT, (messageId) => {
        const message = context.chat[messageId];
        if (!isUserMessage(message)) {
            return;
        }

        ensureUserSwipeFields(message);
    });

    eventSource.on(eventTypes.USER_MESSAGE_RENDERED, (messageId) => {
        requestAnimationFrame(() => refreshRenderedUserMessage(messageId));
    });

    eventSource.on(eventTypes.MESSAGE_UPDATED, (messageId) => {
        requestAnimationFrame(() => persistRenderedUserMessage(messageId));
    });

    eventSource.on(eventTypes.MESSAGE_DELETED, () => {
        requestAnimationFrame(() => refreshRenderedUserMessages());
    });
}

export async function initializeExtension() {
    if (initialized) {
        return;
    }

    bindSwipeClickHandler();
    registerEventHandlers();
    refreshRenderedUserMessages();

    initialized = true;
    console.info(`[${MODULE_NAME}] Initialized.`);
}
