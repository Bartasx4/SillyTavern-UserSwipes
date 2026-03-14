import {
    emitUserMessageRendered,
    getContext,
    getMessage,
    getMessageElement,
    getNewSwipeTimestamp,
    getTimestampText,
    loadSwipe,
    persistSwipe,
    refreshSwipeCounter,
    rerenderMessage,
    runNativeSwipe,
    scheduleChatSave,
    waitForNextFrame,
} from './core.js';
import {
    DOM_LAST_ATTRIBUTE,
    DOM_LEFT_ATTRIBUTE,
    DOM_STATE_ATTRIBUTE,
} from './constants.js';

function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function isUserMessage(message) {
    return Boolean(message?.is_user);
}

function getTokenCount(message) {
    return Number.isFinite(Number(message?.extra?.token_count))
        ? Number(message.extra.token_count)
        : 0;
}

function createCleanExtra(message) {
    return {
        token_count: getTokenCount(message),
    };
}

function createFullSwipeInfoFromMessage(message) {
    return {
        send_date: message?.send_date,
        gen_started: message?.gen_started,
        gen_finished: message?.gen_finished,
        extra: structuredClone(message?.extra ?? {}),
    };
}

function createFallbackSwipeInfo(message) {
    return {
        send_date: message?.send_date,
        gen_started: message?.gen_started,
        gen_finished: message?.gen_finished,
        extra: createCleanExtra(message),
    };
}

function normalizeSwipeIndex(message) {
    if (!Number.isInteger(message.swipe_id) || message.swipe_id < 0) {
        message.swipe_id = 0;
        return true;
    }

    if (message.swipe_id >= message.swipes.length) {
        message.swipe_id = Math.max(0, message.swipes.length - 1);
        return true;
    }

    return false;
}

async function finalizeAnimatedUserSwipe(messageId) {
    await waitForNextFrame();
    decorateUserSwipeState(messageId);
    await emitUserMessageRendered(messageId);
    await waitForNextFrame();
    decorateUserSwipeState(messageId);
}

export function ensureUserSwipeFields(message) {
    if (!isUserMessage(message) || !isPlainObject(message)) {
        return false;
    }

    let updated = false;
    const currentText = String(message.mes ?? '');

    if (!Array.isArray(message.swipes)) {
        message.swipes = [currentText];
        updated = true;
    }

    if (message.swipes.length === 0) {
        message.swipes.push(currentText);
        updated = true;
    }

    for (let index = 0; index < message.swipes.length; index++) {
        if (typeof message.swipes[index] !== 'string') {
            message.swipes[index] = String(message.swipes[index] ?? '');
            updated = true;
        }
    }

    if (normalizeSwipeIndex(message)) {
        updated = true;
    }

    if (!Array.isArray(message.swipe_info)) {
        message.swipe_info = message.swipes.map((_, index) => {
            return index === message.swipe_id
                ? createFullSwipeInfoFromMessage(message)
                : createFallbackSwipeInfo(message);
        });
        updated = true;
    }

    if (message.swipe_info.length > message.swipes.length) {
        message.swipe_info.length = message.swipes.length;
        updated = true;
    }

    while (message.swipe_info.length < message.swipes.length) {
        const index = message.swipe_info.length;
        message.swipe_info.push(index === message.swipe_id
            ? createFullSwipeInfoFromMessage(message)
            : createFallbackSwipeInfo(message));
        updated = true;
    }

    for (let index = 0; index < message.swipe_info.length; index++) {
        if (!isPlainObject(message.swipe_info[index])) {
            message.swipe_info[index] = index === message.swipe_id
                ? createFullSwipeInfoFromMessage(message)
                : createFallbackSwipeInfo(message);
            updated = true;
            continue;
        }

        if (!isPlainObject(message.swipe_info[index].extra)) {
            message.swipe_info[index].extra = index === message.swipe_id
                ? structuredClone(message.extra ?? {})
                : createCleanExtra(message);
            updated = true;
        }

        if (!message.swipe_info[index].send_date) {
            message.swipe_info[index].send_date = message.send_date;
            updated = true;
        }
    }

    if (typeof message.swipes[message.swipe_id] !== 'string') {
        message.swipes[message.swipe_id] = currentText;
        updated = true;
    }

    return updated;
}

function updateTokenCounter(messageElement, message) {
    const tokenCount = Number(message?.extra?.token_count);
    const tokenCounter = messageElement.find('.tokenCounterDisplay');

    if (Number.isFinite(tokenCount) && tokenCount > 0) {
        tokenCounter.text(`${tokenCount}t`);
    } else {
        tokenCounter.empty();
    }
}

function updateTimestamp(messageElement, message) {
    const timestampText = getTimestampText(message.send_date);
    messageElement.find('.timestamp').text(timestampText).attr('title', '');
}

function updateBias(messageElement, message) {
    const context = getContext();
    const biasHtml = context.messageFormatting(message?.extra?.bias ?? '', '', false, false, -1, {}, false);
    messageElement.find('.mes_bias').html(biasHtml);
}

function updateStateAttributes(messageElement, message) {
    const total = Array.isArray(message.swipes) ? message.swipes.length : 0;
    const isLastSwipe = total > 0 && message.swipe_id === total - 1;

    messageElement.attr(DOM_STATE_ATTRIBUTE, 'enabled');
    messageElement.attr(DOM_LEFT_ATTRIBUTE, total > 1 ? 'true' : 'false');
    messageElement.attr(DOM_LAST_ATTRIBUTE, isLastSwipe ? 'true' : 'false');
}

export function clearStateAttributes(messageElement) {
    messageElement.removeAttr(DOM_STATE_ATTRIBUTE);
    messageElement.removeAttr(DOM_LEFT_ATTRIBUTE);
    messageElement.removeAttr(DOM_LAST_ATTRIBUTE);
}

export function decorateUserSwipeState(messageId) {
    const message = getMessage(messageId);
    if (!isUserMessage(message)) {
        return false;
    }

    ensureUserSwipeFields(message);

    const messageElement = getMessageElement(messageId);
    if (!messageElement.length) {
        return false;
    }

    messageElement.attr('swipeid', message.swipe_id ?? 0);
    updateStateAttributes(messageElement, message);
    refreshSwipeCounter(messageId, messageElement, message);
    return true;
}

export function renderUserSwipeState(messageId) {
    const message = getMessage(messageId);
    if (!isUserMessage(message)) {
        return false;
    }

    ensureUserSwipeFields(message);

    const messageElement = getMessageElement(messageId);
    if (!messageElement.length) {
        return false;
    }

    rerenderMessage(messageId, message);
    messageElement.attr('swipeid', message.swipe_id ?? 0);
    updateTimestamp(messageElement, message);
    updateTokenCounter(messageElement, message);
    updateBias(messageElement, message);
    updateStateAttributes(messageElement, message);
    refreshSwipeCounter(messageId, messageElement, message);
    return true;
}

export function persistCurrentUserSwipe(messageId) {
    const message = getMessage(messageId);
    if (!isUserMessage(message)) {
        return false;
    }

    ensureUserSwipeFields(message);
    return persistSwipe(messageId);
}

export async function switchUserSwipe(messageId, targetSwipeId, direction = null) {
    const message = getMessage(messageId);
    if (!isUserMessage(message)) {
        return false;
    }

    ensureUserSwipeFields(message);

    if (!Number.isInteger(targetSwipeId) || targetSwipeId < 0 || targetSwipeId >= message.swipes.length) {
        return false;
    }

    try {
        await runNativeSwipe(messageId, targetSwipeId, direction);
        await finalizeAnimatedUserSwipe(messageId);
    } catch (error) {
        console.warn('[user-swipes] Native swipe transition failed, using static fallback.', error);

        persistCurrentUserSwipe(messageId);

        if (!loadSwipe(messageId, targetSwipeId)) {
            return false;
        }

        getContext().chatMetadata.tainted = true;
        renderUserSwipeState(messageId);
        scheduleChatSave();
        await emitUserMessageRendered(messageId);
    }

    return true;
}

export async function createUserSwipe(messageId) {
    const message = getMessage(messageId);
    if (!isUserMessage(message)) {
        return false;
    }

    ensureUserSwipeFields(message);
    persistCurrentUserSwipe(messageId);

    const currentText = String(message.mes ?? '');
    const sendDate = getNewSwipeTimestamp();
    const cleanExtra = createCleanExtra(message);
    const newSwipeId = message.swipes.length;

    message.swipes.push(currentText);
    message.swipe_info.push({
        send_date: sendDate,
        gen_started: undefined,
        gen_finished: undefined,
        extra: structuredClone(cleanExtra),
    });

    getContext().chatMetadata.tainted = true;

    try {
        await runNativeSwipe(messageId, newSwipeId, 'right');
        await finalizeAnimatedUserSwipe(messageId);
    } catch (error) {
        console.warn('[user-swipes] Native swipe transition failed, using static fallback.', error);

        message.swipe_id = newSwipeId;
        message.mes = currentText;
        message.send_date = sendDate;
        message.gen_started = undefined;
        message.gen_finished = undefined;
        message.extra = structuredClone(cleanExtra);

        renderUserSwipeState(messageId);
        scheduleChatSave();
        await emitUserMessageRendered(messageId);
    }

    return true;
}

export function backfillUserSwipes() {
    const context = getContext();
    let updated = false;

    for (const message of context.chat) {
        if (ensureUserSwipeFields(message)) {
            updated = true;
        }
    }

    if (updated) {
        context.chatMetadata.tainted = true;
        scheduleChatSave();
    }

    return updated;
}
