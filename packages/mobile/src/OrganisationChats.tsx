import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, Pressable,
  SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareView, KeyboardAwareTextInput } from './KeyboardAware';
import { getChatChannels, getChannelMessages, markChannelRead,
  sendChannelMessage, getChatMembers, openDirectChat,
  type ChatMember, type ChatChannel, type ChatMessage, type ChatOrganisation } from './api';
import { subscribeRescueChanges } from '../../core/realtime-client';
import { getRealtimeConfig } from './api';

type Props = { userId: string; initialChannelId?: string; onOpenAnimal?: (animalId: string) => void };
export default function OrganisationChats({ userId, initialChannelId, onOpenAnimal }: Props) {
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [members, setMembers] = useState<ChatMember[]>([]);
  const [directoryMode, setDirectoryMode] = useState<'chats' | 'people'>('chats');
  const [search, setSearch] = useState('');
  const [organisations, setOrganisations] = useState<ChatOrganisation[]>([]);
  const [organisationId, setOrganisationId] = useState('');
  const organisationRef = useRef('');
  const [selected, setSelected] = useState<string | null>(initialChannelId ?? null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const selectedRef = useRef<string | null>(selected);
  useEffect(() => { organisationRef.current = organisationId; }, [organisationId]);
  const listRef = useRef<FlatList<ChatMessage>>(null);
  useEffect(() => { selectedRef.current = selected; }, [selected]);

  const refreshChannels = useCallback(async () => {
    const scope = organisationRef.current;
    const result = await getChatChannels(scope || undefined);
    if (scope && scope !== organisationRef.current) return;
    setOrganisations(result.organisations);
    if (!scope) {
      organisationRef.current = result.organisationId;
      setOrganisationId(result.organisationId);
    }
    setChannels(result.channels);
    if (selectedRef.current && !result.channels.some(channel => channel.id === selectedRef.current)) {
      setSelected(null);
    }
  }, []);
  const refreshMembers = useCallback(async () => {
    const scope = organisationRef.current;
    const result = await getChatMembers(scope || undefined);
    if (scope !== organisationRef.current) return;
    setMembers(result.members);
  }, []);
  const openMember = async (memberId: string) => {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await openDirectChat(memberId, organisationRef.current || undefined);
      await refreshChannels();
      selectedRef.current = response.channelId;
      setSelected(response.channelId);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to open private conversation.');
    } finally { setBusy(false); }
  };
  const refreshMessages = useCallback(async (channelId: string) => {
    const scope = organisationRef.current;
    const result = await getChannelMessages(channelId, undefined, scope || undefined);
    if (selectedRef.current !== channelId || scope !== organisationRef.current) return;
    setMessages(result.items);
    setCursor(result.nextCursor);
    const latest = result.items[result.items.length - 1];
    if (latest) void markChannelRead(channelId, latest.id, scope || undefined).catch(() => {});
  }, []);
  useEffect(() => {
    let active = true;
    const init = async () => {
      try { await Promise.all([refreshChannels(), refreshMembers()]); } catch (e) {
        if (active) setError(e instanceof Error ? e.message : 'Unable to load chat channels.');
      } finally { if (active) setLoading(false); }
    };
    void init();
    let stop: (() => void) | null = null;
    void getRealtimeConfig().then(config => {
      if (!active) return;
      stop = subscribeRescueChanges(config, { onChange: () => {
        void Promise.all([refreshChannels(), refreshMembers()]).catch(() => {});
        if (selectedRef.current) void refreshMessages(selectedRef.current).catch(() => {});
      } });
    }).catch(() => {});
    const poll = setInterval(() => {
      if (!active) return;
      void refreshChannels().catch(() => {});
      if (selectedRef.current) void refreshMessages(selectedRef.current).catch(() => {});
    }, 15000);
    return () => { active = false; stop?.(); clearInterval(poll); };
  }, [refreshChannels, refreshMembers, refreshMessages]);

  useEffect(() => {
    if (!selected) return;
    setMessages([]); setCursor(null); setError('');
    void refreshMessages(selected).catch(e => setError(e instanceof Error ? e.message : 'Cannot read channel.'));
  }, [selected, refreshMessages]);

  const older = async () => {
    if (!selected || !cursor || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const result = await getChannelMessages(selected, cursor, organisationRef.current || undefined);
      if (selectedRef.current === selected) {
        setMessages(previous => [...result.items.filter(item => !previous.some(other => other.id === item.id)), ...previous]);
        setCursor(result.nextCursor);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load earlier messages.'); }
    finally { setLoadingOlder(false); }
  };
  const send = async () => {
    if (!selected || !draft.trim() || busy || busyRecipient) return;
    setBusy(true); setError('');
    try {
      await sendChannelMessage(selected, draft.trim(), undefined, organisationRef.current || undefined);
      setDraft('');
      await Promise.all([refreshMessages(selected), refreshChannels(), refreshMembers()]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to send message.'); }
    finally { setBusy(false); }
  };
  const activeChannel = channels.find(channel => channel.id === selected);
  const recipient = members.find(member => member.id === activeChannel?.recipientUserId);
  const busyRecipient = activeChannel?.recipientAvailability === 'BUSY' || recipient?.availability === 'BUSY';
  const listedMembers = members.filter(member => member.id !== userId &&
    [member.name, ...member.labels].join(' ').toLowerCase().includes(search.toLowerCase()))
    .sort((a,b) => ({ AVAILABLE:0, BUSY:1, OFFLINE:2 })[a.availability] -
      ({ AVAILABLE:0, BUSY:1, OFFLINE:2 })[b.availability] || a.name.localeCompare(b.name));
  const changeOrganisation = (id: string) => {
    if (id === organisationRef.current) return;
    organisationRef.current = id;
    setOrganisationId(id);
    selectedRef.current = null;
    setSelected(null);
    setMessages([]);
    setCursor(null);
    setDraft('');
    setError('');
    setLoading(true);
    void Promise.all([refreshChannels(), refreshMembers()]).catch(e => setError(e instanceof Error ? e.message : 'Unable to open organisation chats.'))
      .finally(() => setLoading(false));
  };

  return <SafeAreaView style={styles.root}><KeyboardAwareView>
    {!selected ? <>
      <View style={styles.heading}><Text style={styles.title}>Chats</Text>
        <Text style={styles.subtitle}>Your organisation and care groups</Text>
        {organisations.length > 1 ? <View style={styles.organisations}>
          <Text style={styles.organisationLabel}>Viewing organisation</Text>
          <ScrollView style={styles.organisationScroll} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {organisations.map(org => <Pressable key={org.id} accessibilityRole="button"
            accessibilityState={{ selected: organisationId === org.id }}
            style={[styles.organisationButton, organisationId === org.id && styles.organisationSelected]}
            onPress={() => changeOrganisation(org.id)}>
            <Text style={organisationId === org.id ? styles.organisationTextSelected : styles.organisationText}>{org.name}</Text>
          </Pressable>)}
          </ScrollView>
        </View> : null}
      </View>
      {loading ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      <View style={styles.directoryTabs}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected:directoryMode==='chats' }}
          style={[styles.tab,directoryMode==='chats' && styles.tabActive]} onPress={() => setDirectoryMode('chats')}>
          <Text style={[styles.tabText,directoryMode==='chats' && styles.tabTextActive]}>Conversations</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityState={{ selected:directoryMode==='people' }}
          style={[styles.tab,directoryMode==='people' && styles.tabActive]} onPress={() => setDirectoryMode('people')}>
          <Text style={[styles.tabText,directoryMode==='people' && styles.tabTextActive]}>People</Text>
        </Pressable>
      </View>
      {directoryMode === 'chats' ?
        <FlatList data={channels} keyExtractor={item => item.id}
          contentContainerStyle={styles.channelList}
          ListEmptyComponent={!loading ? <Text style={styles.subtitle}>No conversations yet. Open People to message a member.</Text> : undefined}
          renderItem={({ item }) => <Pressable accessibilityRole="button"
            accessibilityLabel={item.name + (item.unread ? ', new messages' : '')}
            style={styles.channel} onPress={() => setSelected(item.id)}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0, 1).toUpperCase()}</Text></View>
            <View style={styles.channelBody}>
              <Text style={styles.channelName}>{item.name}</Text>
              <Text style={styles.preview} numberOfLines={1}>
                {item.latest ? `${item.latest.senderName}: ${item.latest.text}` : item.description}
              </Text>
            </View>
            {item.recipientUserId ? <View style={[styles.presence, item.recipientAvailability==='AVAILABLE' ? styles.available :
              item.recipientAvailability==='BUSY' ? styles.busyPresence : styles.offline]}
              accessibilityLabel={item.recipientAvailability ?? 'OFFLINE'} /> : null}
            {item.unread ? <View style={styles.unread} accessibilityLabel="Unread messages" /> : null}
          </Pressable>} /> :
        <>
          <TextInput style={styles.search} value={search} onChangeText={setSearch}
            placeholder="Search name, role or team" accessibilityLabel="Search members" />
          <Text style={styles.directoryHelp}>Availability reflects rescue schedules. Busy members cannot receive new private messages.</Text>
          <FlatList data={listedMembers} keyExtractor={member => member.id}
            contentContainerStyle={styles.channelList}
            ListEmptyComponent={<Text style={styles.subtitle}>No matching members.</Text>}
            renderItem={({ item }) => <Pressable accessibilityRole="button" disabled={busy}
              accessibilityLabel={`${item.name}, ${item.availability.toLowerCase()}, ${item.labels.join(', ')}`}
              style={styles.channel} onPress={() => void openMember(item.id)}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.slice(0,1).toUpperCase()}</Text></View>
              <View style={styles.channelBody}>
                <Text style={styles.channelName}>{item.name}</Text>
                <Text style={styles.preview} numberOfLines={2}>{item.labels.join(' · ') || 'Organisation member'}</Text>
              </View>
              <View style={[styles.presence,item.availability==='AVAILABLE' ? styles.available :
                item.availability==='BUSY' ? styles.busyPresence : styles.offline]} accessibilityLabel={item.availability} />
            </Pressable>} />
        </>
      }
    </> : <>
      <View style={styles.toolbar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back to chats" onPress={() => setSelected(null)}>
          <Text style={styles.back}>‹</Text>
        </Pressable>
        <View style={styles.channelBody}>
          <Text style={styles.channelName}>{activeChannel?.name ?? 'Channel'}</Text>
          <Text numberOfLines={1} style={styles.subtitle}>{recipient ? `${recipient.labels.join(' · ')} · ${recipient.availability.toLowerCase()}` : activeChannel?.description ?? ''}</Text>
        </View>
      </View>
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
      {cursor ? <Pressable accessibilityRole="button" onPress={() => void older()} disabled={loadingOlder}>
        <Text style={styles.loadMore}>{loadingOlder ? 'Loading…' : 'View earlier messages'}</Text>
      </Pressable> : null}
      <FlatList ref={listRef} style={styles.messages} data={messages}
        keyExtractor={item => item.id} contentContainerStyle={styles.messageList}
        onContentSizeChange={() => { if (!cursor) listRef.current?.scrollToEnd({ animated: false }); }}
        ListEmptyComponent={<Text style={styles.subtitle}>Start the conversation with your group.</Text>}
        renderItem={({ item }) => {
          const mine = item.senderUserId === userId;
          return <View style={[styles.bubble, mine ? styles.myBubble : styles.otherBubble]}>
            {!mine ? <Text style={styles.author}>{item.senderName}</Text> : null}
            <Text style={mine ? styles.myText : styles.messageText}>{item.text}</Text>
            <Text style={[styles.timestamp, mine && styles.myTime]}>{new Date(item.createdAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}</Text>
            {item.animalId && onOpenAnimal ? <Pressable accessibilityRole="button"
              onPress={() => onOpenAnimal(item.animalId!)}>
              <Text style={styles.animalLink}>View linked animal</Text>
            </Pressable> : null}
          </View>;
        }} />
      <View>
        {busyRecipient ? <Text style={styles.busyNotice}>This member is busy. Private messages are paused until they are available.</Text> : null}
        <View style={styles.composer}>
          <KeyboardAwareTextInput style={styles.input} value={draft} onChangeText={setDraft}
            multiline maxLength={2000} placeholder={activeChannel?.recipientUserId ? "Write a private message…" : "Message your group…"}
            accessibilityLabel="Chat message" />
          <Pressable accessibilityRole="button" accessibilityLabel="Send message"
            disabled={busy || busyRecipient || !draft.trim()} style={[styles.send, (busy || busyRecipient || !draft.trim()) && styles.disabled]}
            onPress={() => void send()}>
            <Text style={styles.sendText}>Send</Text>
          </Pressable>
        </View>
      </View>
    </>}
  </KeyboardAwareView></SafeAreaView>;
}
const styles=StyleSheet.create({
  root:{flex:1,backgroundColor:'#f5f7f5'},heading:{padding:20,paddingBottom:10},
  organisations:{gap:6,marginTop:12,maxHeight:220},
  organisationScroll:{maxHeight:175},
  organisationLabel:{fontSize:12,fontWeight:'700',color:'#4c6755'},
  organisationButton:{padding:9,borderWidth:1,borderColor:'#d4e1d7',borderRadius:9,backgroundColor:'#fff'},
  organisationSelected:{backgroundColor:'#173d2c'},
  organisationText:{fontSize:12,color:'#173d2c'},
  organisationTextSelected:{fontSize:12,color:'#fff',fontWeight:'700'},
  title:{fontSize:29,fontWeight:'800',color:'#173d2c'},
  subtitle:{fontSize:12,color:'#718077',marginTop:3},
  directoryTabs:{flexDirection:'row',gap:8,paddingHorizontal:16,paddingBottom:12},
  tab:{flex:1,minHeight:44,borderRadius:10,borderWidth:1,borderColor:'#d4e1d7',alignItems:'center',justifyContent:'center',backgroundColor:'#fff'},
  tabActive:{backgroundColor:'#173d2c'},tabText:{color:'#173d2c',fontWeight:'800'},tabTextActive:{color:'#fff'},
  search:{marginHorizontal:16,marginBottom:9,minHeight:44,borderRadius:10,paddingHorizontal:12,backgroundColor:'#fff',borderWidth:1,borderColor:'#d4e1d7',color:'#172c20'},
  directoryHelp:{marginHorizontal:17,marginBottom:12,color:'#68766d',fontSize:12,lineHeight:17},
  presence:{width:12,height:12,borderRadius:6,borderWidth:1,borderColor:'#e0e8e2'},
  available:{backgroundColor:'#17854c'},busyPresence:{backgroundColor:'#bd7121'},offline:{backgroundColor:'#819088'},
  busyNotice:{backgroundColor:'#fff0d7',color:'#684719',padding:12,fontSize:12},
  channelList:{paddingHorizontal:13,paddingBottom:30},
  channel:{backgroundColor:'#fff',borderRadius:12,padding:13,flexDirection:'row',alignItems:'center',gap:12,marginBottom:7},
  avatar:{width:45,height:45,backgroundColor:'#dbe9df',borderRadius:23,alignItems:'center',justifyContent:'center'},
  avatarText:{fontSize:19,fontWeight:'800',color:'#24583f'},
  channelBody:{flex:1,minWidth:0},
  channelName:{fontSize:16,fontWeight:'700',color:'#172c20'},
  preview:{color:'#69776f',fontSize:13,marginTop:4},
  unread:{height:10,width:10,borderRadius:5,backgroundColor:'#236b4b'},
  toolbar:{flexDirection:'row',alignItems:'center',gap:13,padding:12,backgroundColor:'#fff',borderBottomWidth:1,borderBottomColor:'#e0e8e2'},
  back:{fontSize:34,color:'#24583f',paddingHorizontal:7},
  messages:{flex:1},messageList:{padding:14,gap:10,flexGrow:1,justifyContent:'flex-end'},
  bubble:{maxWidth:'85%',borderRadius:16,padding:12,gap:5},
  myBubble:{backgroundColor:'#d8eede',alignSelf:'flex-end',borderBottomRightRadius:4},
  otherBubble:{backgroundColor:'#fff',alignSelf:'flex-start',borderBottomLeftRadius:4},
  author:{fontSize:12,fontWeight:'800',color:'#276245'},
  messageText:{fontSize:15,color:'#22342a',lineHeight:21},
  myText:{fontSize:15,color:'#1a3b2a',lineHeight:21},
  timestamp:{fontSize:10,color:'#819087',alignSelf:'flex-end'},
  myTime:{color:'#507862'},animalLink:{color:'#256b4c',fontWeight:'700'},
  composer:{backgroundColor:'#fff',borderTopColor:'#dce6de',borderTopWidth:1,padding:10,flexDirection:'row',gap:8,alignItems:'flex-end'},
  input:{flex:1,minHeight:42,maxHeight:115,borderRadius:22,backgroundColor:'#f1f5f2',paddingHorizontal:15,paddingVertical:10,fontSize:15},
  send:{paddingVertical:12,paddingHorizontal:15,backgroundColor:'#173d2c',borderRadius:22},
  sendText:{color:'#fff',fontWeight:'800'},disabled:{opacity:.5},
  loadMore:{textAlign:'center',padding:12,color:'#236b4b',fontWeight:'700'},
  error:{padding:9,color:'#a23f35'}
});
