import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet } from 'react-native';
import { Button, Dialog, Portal, RadioButton, Text } from 'react-native-paper';
import { C } from '../../theme/colors';
import { HandicapFloor, PlayerHandicap } from '../../types';

interface HandicapDialogProps {
    visible: boolean;
    playerName: string;
    value: PlayerHandicap | undefined;
    onDismiss: () => void;
    onSave: (handicap: PlayerHandicap | undefined) => void;
}

export const HandicapDialog: React.FC<HandicapDialogProps> = ({ visible, playerName, value, onDismiss, onSave }) => {
    const { t } = useTranslation();
    const [strokes, setStrokes] = useState(value?.strokes ?? 0);
    const [floor, setFloor] = useState<HandicapFloor>(value?.floor ?? 'none');

    useEffect(() => {
        if (!visible) return;
        setStrokes(value?.strokes ?? 0);
        setFloor(value?.floor ?? 'none');
    }, [visible, value]);

    const handleSave = () => {
        onSave(strokes > 0 ? { strokes, floor } : undefined);
    };

    return (
        <Portal>
            <Dialog visible={visible} onDismiss={onDismiss}>
                <Dialog.Title>{t('setup.handicapTitle', { name: playerName })}</Dialog.Title>
                <Dialog.Content style={styles.content}>
                    {/* 横並びだと小さい画面で Every One が見切れるため、縦に並べる */}
                    <Text style={styles.label}>{t('setup.handicapStrokes')}</Text>
                    <RadioButton.Group value={String(strokes)} onValueChange={v => setStrokes(Number(v))}>
                        <RadioButton.Item label={t('setup.handicapNone')} value="0" style={styles.option} />
                        <RadioButton.Item label={t('setup.handicapEveryOne')} value="1" style={styles.option} />
                        <RadioButton.Item label={t('setup.handicapEveryTwo')} value="2" style={styles.option} />
                    </RadioButton.Group>
                    <Text style={[styles.label, strokes === 0 && styles.disabled]}>{t('setup.handicapFloor')}</Text>
                    <RadioButton.Group value={floor} onValueChange={v => setFloor(v as HandicapFloor)}>
                        <RadioButton.Item label={t('setup.handicapFloorNone')} value="none" disabled={strokes === 0} style={styles.option} />
                        <RadioButton.Item label={t('setup.handicapFloorPar')} value="par" disabled={strokes === 0} style={styles.option} />
                        <RadioButton.Item label={t('setup.handicapFloorBogey')} value="bogey" disabled={strokes === 0} style={styles.option} />
                    </RadioButton.Group>
                    <Text style={styles.help}>{t('setup.handicapHelp')}</Text>
                </Dialog.Content>
                <Dialog.Actions>
                    <Button onPress={onDismiss}>{t('common.cancel')}</Button>
                    <Button onPress={handleSave}>{t('common.save')}</Button>
                </Dialog.Actions>
            </Dialog>
        </Portal>
    );
};

const styles = StyleSheet.create({
    content: { gap: 0 },
    label: { color: C.ink3, fontSize: 13, fontWeight: '600', marginTop: 4 },
    disabled: { color: C.ink5 },
    help: { color: C.ink4, fontSize: 12, marginTop: 4 },
    option: { paddingVertical: 2, paddingHorizontal: 0 },
});
