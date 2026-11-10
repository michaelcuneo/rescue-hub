import { Pressable, StyleSheet, Text, View } from 'react-native';
type Tab = 'rescues' | 'chats' | 'account';
export default function BottomTabs({ active, onSelect }: {
  active: Tab; onSelect: (tab: Tab) => void;
}) {
  const tabs = [
    { id: 'rescues', icon: '⌖', title: 'Rescues' },
    { id: 'chats', icon: '◉', title: 'Chats' },
    { id: 'account', icon: '♙', title: 'Account' }
  ] as const;
  return <View style={styles.bar} accessibilityRole="tablist">
    {tabs.map(tab => <Pressable key={tab.id}
      accessibilityRole="tab" accessibilityState={{ selected: active === tab.id }}
      accessibilityLabel={tab.title} style={styles.tab} onPress={() => onSelect(tab.id)}>
      <Text style={[styles.icon, active === tab.id && styles.active]}>{tab.icon}</Text>
      <Text style={[styles.label, active === tab.id && styles.active]}>{tab.title}</Text>
    </Pressable>)}
  </View>;
}
const styles = StyleSheet.create({
  bar: { flexDirection:'row',backgroundColor:'#fff',borderTopWidth:1,borderTopColor:'#dfe7e1',
    paddingTop:8,paddingBottom:7,minHeight:66 },
  tab:{flex:1,alignItems:'center',justifyContent:'center',gap:3,minHeight:48},
  icon:{fontSize:24,color:'#7c8d82',fontWeight:'600'},
  label:{fontSize:12,fontWeight:'600',color:'#7c8d82'},
  active:{color:'#173d2c',fontWeight:'800'}
});
