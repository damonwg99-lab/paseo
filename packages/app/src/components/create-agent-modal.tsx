import { View, Text, Pressable, ScrollView, TextInput } from "react-native";
import { useCallback, useState } from "react";
import { StyleSheet, useUnistyles } from "react-native-unistyles";
import { Modal } from "react-native";

interface CreateAgentModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (prompt: string) => void;
  defaultPrompt: string;
}

export function CreateAgentModal({
  visible,
  onClose,
  onConfirm,
  defaultPrompt,
}: CreateAgentModalProps) {
  const { theme } = useUnistyles();
  const [prompt, setPrompt] = useState(defaultPrompt);

  const handleConfirm = useCallback(() => {
    onConfirm(prompt.trim());
  }, [prompt, onConfirm]);

  const handleClose = useCallback(() => {
    setPrompt(defaultPrompt);
    onClose();
  }, [defaultPrompt, onClose]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.modalContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Create agent</Text>
          <Text style={styles.subtitle}>Review and edit the prompt before creating</Text>
        </View>
        <ScrollView style={styles.promptScroll} contentContainerStyle={styles.promptContent}>
          <TextInput
            style={styles.promptInput}
            value={prompt}
            onChangeText={setPrompt}
            multiline
            placeholder="Agent prompt"
            placeholderTextColor={theme.colors.foregroundMuted}
            autoFocus
          />
        </ScrollView>
        <View style={styles.actions}>
          <Pressable onPress={handleClose} style={styles.cancelButton}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable onPress={handleConfirm} style={styles.confirmButton}>
            <Text style={styles.confirmText}>Create agent</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create((theme) => ({
  modalContainer: {
    flex: 1,
    backgroundColor: theme.colors.surface0,
    padding: theme.spacing[4],
    paddingTop: theme.spacing[8],
  },
  header: {
    gap: theme.spacing[1],
    marginBottom: theme.spacing[4],
  },
  title: {
    fontSize: theme.fontSize.lg,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
  subtitle: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  promptScroll: {
    flex: 1,
  },
  promptContent: {
    paddingBottom: theme.spacing[4],
  },
  promptInput: {
    fontSize: theme.fontSize.base,
    color: theme.colors.foreground,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.md,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
    minHeight: 200,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: theme.spacing[2],
    paddingVertical: theme.spacing[3],
  },
  cancelButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
  },
  cancelText: {
    fontSize: theme.fontSize.sm,
    color: theme.colors.foregroundMuted,
  },
  confirmButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface2,
  },
  confirmText: {
    fontSize: theme.fontSize.sm,
    fontWeight: theme.fontWeight.medium,
    color: theme.colors.foreground,
  },
}));
