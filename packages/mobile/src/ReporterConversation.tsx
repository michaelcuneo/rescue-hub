import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareView, KeyboardAwareTextInput } from './KeyboardAware';
import { getReporterConversation, sendReporterMessage, type ReporterMessage } from './api';

type Props = { reportId: string; onBack: () => void };
export default function ReporterConversation({ reportId, onBack }: Props) {
  const [messages, setMessages] = useState<ReporterMessage[]>([]);
  const [role, setRole] = useState<'REPORTER' | 'RESCUER'>('REPORTER');
  const [phone, setPhone] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    const result = await getReporterConversation(reportId);
    setMessages(result.items);
    setRole(result.role);
    setPhone(result.contactPhone);
    setError('');
    setLoading(false);
  }, [reportId]);
  useEffect(() => {
    void refresh().catch(error => { setError(error instanceof Error ? error.message : 'Conversation unavailable'); setLoading(false); });
    const poll = setInterval(() => { void refresh().catch(() => {}); }, 15000);
    return () => clearInterval(poll);
  }, [refresh]);
  async function send() {
    if (!message.trim() || busy) return;
    setBusy(true);
    try {
      await sendReporterMessage(reportId, message);
      setMessage('');
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Message could not be sent'); }
    finally { setBusy(false); }
  }
  return <KeyboardAwareView style={styles.root}>
    <Pressable style={styles.back} onPress={onBack} accessibilityRole="button"><Text style={styles.link}>‹ Back</Text></Pressable>
    <Text style={styles.title}>{role === 'REPORTER' ? 'Your rescue conversation' : 'Contact the wildlife reporter'}</Text>
    <Text style={styles.hint}>Only the reporter and the assigned responder can see these messages. Do not share personal addresses in this conversation.</Text>
    {phone ? <Pressable onPress={() => void Linking.openURL('tel:' + phone)} accessibilityRole="button">
      <Text style={styles.link}>Call reporter: {phone}</Text>
    </Pressable> : null}
    {error ? <Text style={styles.error}>{error}</Text> : null}
    {loading ? <ActivityIndicator /> : null}
    <ScrollView style={styles.history} contentContainerStyle={styles.historyContent}>
      {messages.map(item => <View style={styles.bubble} key={item.id}>
        <Text style={styles.name}>{item.senderRole === 'REPORTER' ? 'Reporter' : 'Rescuer'} · {new Date(item.createdAt).toLocaleString()}</Text>
        <Text style={styles.body}>{item.text}</Text>
      </View>)}
      {!messages.length && !loading ? <Text style={styles.hint}>No messages yet.</Text> : null}
    </ScrollView>
    <KeyboardAwareTextInput style={styles.input} value={message} onChangeText={setMessage} maxLength={1500}
      multiline placeholder="Write a message…" accessibilityLabel="Message to the other participant" />
    <Pressable style={styles.button} disabled={busy || !message.trim()} onPress={() => void send()} accessibilityRole="button">
      <Text style={styles.buttonText}>{busy ? 'Sending…' : 'Send message'}</Text>
    </Pressable>
  </KeyboardAwareView>;
}
const styles = StyleSheet.create({
  root:{flex:1,padding:16,backgroundColor:'#f1f5f2',gap:10},
  back:{paddingVertical:8},link:{color:'#24583f',fontWeight:'800',fontSize:15},
  title:{fontSize:21,fontWeight:'900',color:'#173d2c'},hint:{fontSize:12,color:'#526358'},
  error:{color:'#a23f35',fontWeight:'700'},history:{flex:1},
  historyContent:{gap:12,paddingVertical:12},bubble:{padding:12,backgroundColor:'#fff',borderRadius:10,gap:5},
  name:{fontSize:11,fontWeight:'800',color:'#526358'},body:{color:'#1b2d24',fontSize:15},
  input:{backgroundColor:'#fff',borderColor:'#cbd9d0',borderWidth:1,padding:12,borderRadius:10,minHeight:62},
  button:{backgroundColor:'#173d2c',borderRadius:10,padding:13,alignItems:'center'},
  buttonText:{color:'#fff',fontWeight:'900'}
});
