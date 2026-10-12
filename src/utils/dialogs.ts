import { Alert, Platform } from 'react-native';

// react-native-web の Alert.alert はボタン付きダイアログを表示しない（何も起きない）ため、
// Web では window.confirm / window.alert にフォールバックする。

interface ConfirmOptions {
    title: string;
    message?: string;
    okText: string;
    cancelText: string;
    destructive?: boolean;
    onConfirm: () => void;
}

export function confirmAction({ title, message, okText, cancelText, destructive, onConfirm }: ConfirmOptions): void {
    if (Platform.OS === 'web') {
        const text = message ? `${title}\n\n${message}` : title;
        if (window.confirm(text)) onConfirm();
        return;
    }
    Alert.alert(title, message ?? '', [
        { text: cancelText, style: 'cancel' },
        { text: okText, style: destructive ? 'destructive' : 'default', onPress: onConfirm },
    ]);
}

export function notify(title: string, message: string, okText: string, onClose?: () => void): void {
    if (Platform.OS === 'web') {
        window.alert(message ? `${title}\n\n${message}` : title);
        onClose?.();
        return;
    }
    Alert.alert(title, message, [{ text: okText, onPress: onClose }], { onDismiss: onClose });
}
