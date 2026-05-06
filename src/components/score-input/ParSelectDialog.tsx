import React from 'react';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';
import { Button, Dialog, Portal } from 'react-native-paper';

interface ParSelectDialogProps {
    visible: boolean;
    onSelect: (par: 3 | 4 | 5) => void;
}

export const ParSelectDialog: React.FC<ParSelectDialogProps> = ({ visible, onSelect }) => {
    const { t } = useTranslation();

    return (
        <Portal>
            <Dialog visible={visible} dismissable={false}>
                <Dialog.Title style={{ textAlign: 'center' }}>{t('common.selectPar')}</Dialog.Title>
                <Dialog.Content>
                    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10 }}>
                        {([3, 4, 5] as const).map(p => (
                            <Button
                                key={p}
                                mode="contained"
                                onPress={() => onSelect(p)}
                                style={{ flex: 1, marginHorizontal: 4 }}
                                contentStyle={{ paddingVertical: 14 }}
                                labelStyle={{ fontSize: 28, fontWeight: 'bold', lineHeight: 36, includeFontPadding: false }}
                            >
                                {p}
                            </Button>
                        ))}
                    </View>
                </Dialog.Content>
            </Dialog>
        </Portal>
    );
};
