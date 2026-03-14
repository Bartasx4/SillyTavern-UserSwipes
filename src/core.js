import {
    saveChatDebounced,
    swipe as nativeSwipe,
    syncMesToSwipe,
    syncSwipeToMes,
    updateSwipeCounter,
    updateMessageBlock,
} from '../../../../../script.js';
import { getMessageTimeStamp } from '../../../../../scripts/RossAscends-mods.js';

export function getContext() {
    return SillyTavern.getContext();
}

export function getChat() {
    return getContext().chat;
}

export function getMessage(messageId) {
    return getChat()[messageId];
}

export function getMessageElement(messageId) {
    return $('#chat').children('.mes').filter(`[mesid="${messageId}"]`);
}

export function getTimestampText(sendDate) {
    const context = getContext();
    const momentDate = context.timestampToMoment(sendDate);
    return momentDate.isValid() ? momentDate.format('LL LT') : '';
}

export function getNewSwipeTimestamp() {
    return getMessageTimeStamp();
}

export function scheduleChatSave() {
    saveChatDebounced();
}

export async function runNativeSwipe(messageId, targetSwipeId, direction = null) {
    const message = getMessage(messageId);
    const swipeDirection = direction ?? (targetSwipeId > Number(message?.swipe_id ?? 0) ? 'right' : 'left');

    await nativeSwipe(null, swipeDirection, {
        source: 'auto_swipe',
        message,
        forceMesId: messageId,
        forceSwipeId: targetSwipeId,
    });
}

export async function emitUserMessageRendered(messageId) {
    const context = getContext();
    await context.eventSource.emit(context.eventTypes.USER_MESSAGE_RENDERED, messageId);
}

export async function waitForNextFrame() {
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export function persistSwipe(messageId) {
    return syncMesToSwipe(messageId);
}

export function loadSwipe(messageId, swipeId) {
    return syncSwipeToMes(messageId, swipeId);
}

export function refreshSwipeCounter(messageId, messageElement, message) {
    return updateSwipeCounter(messageId, {
        message,
        messageElement,
    });
}

export function rerenderMessage(messageId, message) {
    updateMessageBlock(messageId, message, { rerenderMessage: true });
}
