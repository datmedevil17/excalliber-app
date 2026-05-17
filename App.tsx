import React, { useState } from 'react';
import {
  Image, ScrollView, StatusBar, StyleSheet, Text, TouchableOpacity, View,
} from 'react-native';
import { usePhantomWallet, WalletState } from './src/usePhantomWallet';
import WebView from 'react-native-webview';
import { buildMapHTML }            from './src/buildMapHTML';
import { buildMapPreviewHTML }     from './src/buildMapPreviewHTML';
import { buildSimpleSurvivalHTML } from './src/buildSimpleSurvivalHTML';
import { MAP_GLB_B64 }  from './src/mapData';
import { MAP2_GLB_B64 } from './src/map2Data';
import { SOLDIER_B64 }  from './src/soldierData';
import { HAZMAT_B64 }   from './src/Character_HazmatData';

type Screen   = 'start' | 'shop' | 'charSelect' | 'weaponSelect' | 'mapSelect' | 'game' | 'survival';
type GameMode = 'arena' | 'survival';

const CHARACTERS = [
  { id: 'soldier', label: 'Soldier', role: 'ASSAULT', icon: '🪖', b64: SOLDIER_B64 },
  { id: 'hazmat',  label: 'Hazmat',  role: 'SUPPORT', icon: '☣️',  b64: HAZMAT_B64  },
];

const WEAPONS = [
  { id: 'AK',             label: 'AK-47',        icon: '🔫', desc: 'Full Auto Rifle'  },
  { id: 'SMG',            label: 'SMG',           icon: '🔫', desc: 'Submachine Gun'   },
  { id: 'Pistol',         label: 'PISTOL',        icon: '🔫', desc: 'Sidearm'          },
  { id: 'Shotgun',        label: 'SHOTGUN',       icon: '🔫', desc: 'Close Range'      },
  { id: 'Sniper',         label: 'SNIPER',        icon: '🔭', desc: 'Long Range'       },
  { id: 'Sniper_2',       label: 'SNIPER MK2',    icon: '🔭', desc: 'Precision'        },
  { id: 'Revolver_Small', label: 'REVOLVER',      icon: '🔫', desc: 'Heavy Pistol'     },
  { id: 'RocketLauncher', label: 'ROCKET',        icon: '🚀', desc: 'Explosive'        },
  { id: 'ShortCannon',    label: 'CANNON',        icon: '💣', desc: 'Artillery'        },
  { id: 'GrenadeLauncher',label: 'GRENADE',       icon: '💥', desc: 'Area Damage'      },
];

const MAPS = [
  {
    id: 'map1', label: 'INDUSTRIAL ZONE', subtitle: 'Urban Warfare',
    tags: ['Containers', 'Barriers', 'Close Range'],
    accent: '#4a8fc4', b64: MAP_GLB_B64,
  },
  {
    id: 'map2', label: 'WILDERNESS', subtitle: 'Outdoor Survival',
    tags: ['Bear Traps', 'Trees', 'Open Field'],
    accent: '#4aaa5c', b64: MAP2_GLB_B64,
  },
];

const GOLD   = '#f0c040';
const GOLD_D = 'rgba(240,192,64,0.14)';
const BG     = '#020308';

const map1Preview = buildMapPreviewHTML(MAP_GLB_B64);
const map2Preview = buildMapPreviewHTML(MAP2_GLB_B64);
const MAP_PREVIEWS: Record<string, string> = { map1: map1Preview, map2: map2Preview };

export default function App() {
  const [screen,   setScreen]   = useState<Screen>('start');
  const [gameMode, setGameMode] = useState<GameMode>('arena');
  const [charId,   setCharId]   = useState('soldier');
  const [weaponId, setWeaponId] = useState('AK');
  const [mapId,    setMapId]    = useState('map1');
  const [gameHTML,     setGameHTML]     = useState<string | null>(null);
  const [survivalHTML, setSurvivalHTML] = useState<string | null>(null);
  const { state: walletState, connect, disconnect } = usePhantomWallet();

  function beginArena() { setGameMode('arena'); setScreen('charSelect'); }
  function beginSurvival() { setGameMode('survival'); setScreen('charSelect'); }

  function afterWeaponSelect() {
    if (gameMode === 'survival') {
      const char = CHARACTERS.find(c => c.id === charId) ?? CHARACTERS[0];
      setSurvivalHTML(buildSimpleSurvivalHTML(char.b64, weaponId));
      setScreen('survival');
    } else {
      setScreen('mapSelect');
    }
  }

  function startGame() {
    const char = CHARACTERS.find(c => c.id === charId) ?? CHARACTERS[0];
    const map  = MAPS.find(m => m.id === mapId)        ?? MAPS[0];
    setGameHTML(buildMapHTML(char.b64, map.b64, weaponId));
    setScreen('game');
  }

  return (
    <View style={s.root}>
      <StatusBar hidden />

      {screen !== 'game' && screen !== 'survival' && MAPS.map(m => (
        <View key={m.id} style={[s.fill, (screen !== 'mapSelect' || mapId !== m.id) && s.hidden]}>
          <WebView source={{ html: MAP_PREVIEWS[m.id] }} originWhitelist={['*']}
            javaScriptEnabled scrollEnabled={false} style={s.fill} />
        </View>
      ))}

      {gameHTML != null && (
        <View style={[s.fill, screen !== 'game' && s.hidden]}>
          <WebView style={s.fill} source={{ html: gameHTML }} originWhitelist={['*']}
            javaScriptEnabled domStorageEnabled scrollEnabled={false}
            mediaPlaybackRequiresUserAction={false} />
          <TouchableOpacity style={s.closeBtn} onPress={() => setScreen('start')}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {survivalHTML != null && (
        <View style={[s.fill, screen !== 'survival' && s.hidden]}>
          <WebView style={s.fill} source={{ html: survivalHTML }} originWhitelist={['*']}
            javaScriptEnabled domStorageEnabled scrollEnabled={false}
            mediaPlaybackRequiresUserAction={false} />
          <TouchableOpacity style={s.closeBtn} onPress={() => setScreen('start')}>
            <Text style={s.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>
      )}

      {screen === 'start' && (
        <StartScreen
          onPlay={beginArena} onSurvival={beginSurvival}
          onShop={() => setScreen('shop')}
          walletState={walletState} onConnect={connect} onDisconnect={disconnect}
        />
      )}
      {screen === 'shop' && (
        <WeaponShopScreen
          selected={weaponId} onSelect={setWeaponId}
          onBack={() => setScreen('start')}
        />
      )}
      {screen === 'charSelect' && (
        <CharSelectScreen
          selected={charId} onSelect={setCharId}
          onNext={() => setScreen('weaponSelect')}
          onBack={() => setScreen('start')}
        />
      )}
      {screen === 'weaponSelect' && (
        <WeaponSelectScreen
          selected={weaponId} onSelect={setWeaponId}
          onNext={afterWeaponSelect}
          onBack={() => setScreen('charSelect')}
          mode={gameMode}
        />
      )}
      {screen === 'mapSelect' && (
        <MapSelectScreen
          selected={mapId} onSelect={setMapId}
          onPlay={startGame} onBack={() => setScreen('weaponSelect')}
        />
      )}
    </View>
  );
}

/* ── Start Screen ── */
function StartScreen({ onPlay, onSurvival, onShop, walletState, onConnect, onDisconnect }: {
  onPlay: () => void; onSurvival: () => void; onShop: () => void;
  walletState: WalletState; onConnect: () => void; onDisconnect: () => void;
}) {
  const connected  = walletState.status === 'connected';
  const connecting = walletState.status === 'connecting';
  return (
    <View style={s.screen}>
      <Scanlines />
      <View style={s.cornerTL} /><View style={s.cornerTR} />
      <View style={s.cornerBL} /><View style={s.cornerBR} />

      {/* Landscape split: logo left, buttons right */}
      <View style={s.startRow}>

        {/* ── Left: branding ── */}
        <View style={s.startLeft}>
          <Image
            source={require('./logo.png')}
            style={s.logoImg}
            resizeMode="contain"
          />
          <Text style={s.tagline}>TACTICAL WARFARE</Text>
        </View>

        {/* ── Right: buttons ── */}
        <View style={s.startRight}>
          <TouchableOpacity style={s.playBtn} onPress={onPlay} activeOpacity={0.7}>
            <Text style={s.playTxt}>▶  ENTER THE ARENA</Text>
          </TouchableOpacity>

          <View style={s.startBtnRow}>
            <TouchableOpacity style={s.survivalBtn} onPress={onSurvival} activeOpacity={0.7}>
              <Text style={s.survivalTxt}>☠  SURVIVAL</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.shopBtn} onPress={onShop} activeOpacity={0.7}>
              <Text style={s.shopTxt}>🛒  ARMORY</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[s.walletBtn, connected && s.walletBtnConnected]}
            onPress={connected ? onDisconnect : onConnect}
            activeOpacity={0.75} disabled={connecting}
          >
            <Text style={[s.walletTxt, connected && s.walletTxtConnected]}>
              {connecting
                ? '◌  CONNECTING...'
                : connected
                ? `◉  ${(walletState as any).publicKey.slice(0,4)}...${(walletState as any).publicKey.slice(-4)}`
                : '◎  CONNECT WALLET'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <Text style={s.versionTxt}>v1.0</Text>
    </View>
  );
}

/* ── Armory / Shop Screen ── */
function WeaponShopScreen({ selected, onSelect, onBack }: {
  selected: string; onSelect: (id: string) => void; onBack: () => void;
}) {
  return (
    <View style={s.screen}>
      <Scanlines />
      <View style={s.cornerTL} /><View style={s.cornerTR} />
      <View style={s.cornerBL} /><View style={s.cornerBR} />
      <View style={s.csHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>‹  BACK</Text></TouchableOpacity>
        <View style={s.csTitleWrap}>
          <Text style={s.csEyebrow}>BROWSE &amp; EQUIP</Text>
          <Text style={s.csTitle}>ARMORY</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>
      <WeaponGrid selected={selected} onSelect={onSelect} />
      <View style={s.detailStrip}>
        <Text style={s.detailName}>{WEAPONS.find(w => w.id === selected)?.label}</Text>
        <Text style={s.detailRole}>{WEAPONS.find(w => w.id === selected)?.desc}</Text>
        <TouchableOpacity style={s.confirmBtn} onPress={onBack} activeOpacity={0.75}>
          <Text style={s.confirmTxt}>EQUIP  ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Weapon Select Screen (in game flow) ── */
function WeaponSelectScreen({ selected, onSelect, onNext, onBack, mode }: {
  selected: string; onSelect: (id: string) => void;
  onNext: () => void; onBack: () => void; mode: GameMode;
}) {
  const nextLabel = mode === 'survival' ? 'DEPLOY  ›' : 'SELECT MAP  ›';
  return (
    <View style={s.screen}>
      <Scanlines />
      <View style={s.cornerTL} /><View style={s.cornerTR} />
      <View style={s.cornerBL} /><View style={s.cornerBR} />
      <View style={s.csHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>‹  BACK</Text></TouchableOpacity>
        <View style={s.csTitleWrap}>
          <Text style={s.csEyebrow}>CHOOSE YOUR</Text>
          <Text style={s.csTitle}>LOADOUT</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>
      <WeaponGrid selected={selected} onSelect={onSelect} />
      <View style={s.detailStrip}>
        <Text style={s.detailName}>{WEAPONS.find(w => w.id === selected)?.label}</Text>
        <Text style={s.detailRole}>{WEAPONS.find(w => w.id === selected)?.desc}</Text>
        <TouchableOpacity style={s.confirmBtn} onPress={onNext} activeOpacity={0.75}>
          <Text style={s.confirmTxt}>{nextLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Shared weapon grid ── */
function WeaponGrid({ selected, onSelect }: { selected: string; onSelect: (id: string) => void }) {
  return (
    <ScrollView contentContainerStyle={s.weaponGrid} showsVerticalScrollIndicator={false}
      style={{ flex: 1, width: '100%' }}>
      {WEAPONS.map(w => {
        const active = w.id === selected;
        return (
          <TouchableOpacity key={w.id} onPress={() => onSelect(w.id)} activeOpacity={0.8}
            style={[s.weaponCard, active && s.weaponCardActive]}>
            {active && <View style={s.cardGlow} />}
            <Text style={s.weaponIcon}>{w.icon}</Text>
            <Text style={[s.weaponLabel, active && s.weaponLabelActive]}>{w.label}</Text>
            <Text style={[s.weaponDesc,  active && s.weaponDescActive]}>{w.desc}</Text>
            {active && <View style={s.activePip} />}
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

/* ── Character Select ── */
function CharSelectScreen({ selected, onSelect, onNext, onBack }: {
  selected: string; onSelect: (id: string) => void; onNext: () => void; onBack: () => void;
}) {
  const sel = CHARACTERS.find(c => c.id === selected)!;
  return (
    <View style={s.screen}>
      <Scanlines />
      <View style={s.cornerTL} /><View style={s.cornerTR} />
      <View style={s.cornerBL} /><View style={s.cornerBR} />
      <View style={s.csHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>‹  BACK</Text></TouchableOpacity>
        <View style={s.csTitleWrap}>
          <Text style={s.csEyebrow}>SELECT YOUR</Text>
          <Text style={s.csTitle}>WARRIOR</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>
      <View style={s.cardsRow}>
        {CHARACTERS.map(c => {
          const active = c.id === selected;
          return (
            <TouchableOpacity key={c.id} onPress={() => onSelect(c.id)} activeOpacity={0.8}
              style={[s.card, active && s.cardActive]}>
              {active && <View style={s.cardGlow} />}
              <View style={[s.iconRing, active && s.iconRingActive]}>
                <Text style={s.cardIcon}>{c.icon}</Text>
              </View>
              <Text style={[s.cardName, active && s.cardNameActive]}>{c.label.toUpperCase()}</Text>
              <Text style={[s.cardRole, active && s.cardRoleActive]}>{c.role}</Text>
              {active && <View style={s.activePip} />}
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.detailStrip}>
        <Text style={s.detailIcon}>{sel.icon}</Text>
        <View>
          <Text style={s.detailName}>{sel.label.toUpperCase()}</Text>
          <Text style={s.detailRole}>{sel.role}</Text>
        </View>
        <TouchableOpacity style={s.confirmBtn} onPress={onNext} activeOpacity={0.75}>
          <Text style={s.confirmTxt}>SELECT WEAPON  ›</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

/* ── Map Select ── */
function MapSelectScreen({ selected, onSelect, onPlay, onBack }: {
  selected: string; onSelect: (id: string) => void; onPlay: () => void; onBack: () => void;
}) {
  const sel = MAPS.find(m => m.id === selected)!;
  return (
    <View style={s.screen}>
      <Scanlines />
      <View style={s.cornerTL} /><View style={s.cornerTR} />
      <View style={s.cornerBL} /><View style={s.cornerBR} />
      <View style={s.csHeader}>
        <TouchableOpacity onPress={onBack} style={s.backBtn}><Text style={s.backTxt}>‹  BACK</Text></TouchableOpacity>
        <View style={s.csTitleWrap}>
          <Text style={s.csEyebrow}>SELECT YOUR</Text>
          <Text style={s.csTitle}>BATTLEFIELD</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>
      <View style={s.mapCardsRow}>
        {MAPS.map(m => {
          const active = m.id === selected;
          return (
            <TouchableOpacity key={m.id} onPress={() => onSelect(m.id)} activeOpacity={0.85}
              style={[s.mapCard, active && { borderColor: m.accent, borderWidth: 2 }]}>
              <View style={s.mapPreviewWrap}>
                <WebView source={{ html: MAP_PREVIEWS[m.id] }} originWhitelist={['*']}
                  javaScriptEnabled scrollEnabled={false} style={s.fill} pointerEvents="none" />
                {active && (
                  <View style={[s.mapPreviewBadge, { backgroundColor: m.accent }]}>
                    <Text style={s.mapPreviewBadgeTxt}>SELECTED</Text>
                  </View>
                )}
              </View>
              <View style={s.mapCardInfo}>
                <Text style={[s.mapCardTitle, active && { color: m.accent }]}>{m.label}</Text>
                <Text style={s.mapCardSub}>{m.subtitle}</Text>
                <View style={s.mapTagsRow}>
                  {m.tags.map(t => (
                    <View key={t} style={[s.mapTag, active && { borderColor: m.accent }]}>
                      <Text style={[s.mapTagTxt, active && { color: m.accent }]}>{t}</Text>
                    </View>
                  ))}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={s.detailStrip}>
        <Text style={[s.detailName, { color: sel.accent }]}>{sel.label}</Text>
        <Text style={s.detailRole}>{sel.subtitle}  ·  11 SPAWN POINTS</Text>
        <TouchableOpacity style={[s.confirmBtn, { borderColor: sel.accent }]} onPress={onPlay} activeOpacity={0.75}>
          <Text style={[s.confirmTxt, { color: sel.accent }]}>▶  DEPLOY</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Scanlines() {
  return (
    <View style={s.scanlines} pointerEvents="none">
      {Array.from({ length: 20 }).map((_, i) => <View key={i} style={s.scanline} />)}
    </View>
  );
}

const s = StyleSheet.create({
  root:   { flex:1, backgroundColor:'#000' },
  fill:   { flex:1 },
  hidden: { position:'absolute', width:'100%', height:'100%', opacity:0, zIndex:-1 } as any,
  screen: { ...StyleSheet.absoluteFill, backgroundColor:BG, alignItems:'center', justifyContent:'center', zIndex:10 },

  /* Corner brackets */
  cornerTL: { position:'absolute', top:14, left:14, width:28, height:28, borderTopWidth:2, borderLeftWidth:2, borderColor:GOLD },
  cornerTR: { position:'absolute', top:14, right:14, width:28, height:28, borderTopWidth:2, borderRightWidth:2, borderColor:GOLD },
  cornerBL: { position:'absolute', bottom:14, left:14, width:28, height:28, borderBottomWidth:2, borderLeftWidth:2, borderColor:GOLD },
  cornerBR: { position:'absolute', bottom:14, right:14, width:28, height:28, borderBottomWidth:2, borderRightWidth:2, borderColor:GOLD },

  scanlines: { ...StyleSheet.absoluteFill, flexDirection:'column', justifyContent:'space-around', opacity:0.04 },
  scanline:  { height:1, backgroundColor:'#adf' },

  /* ── Start Screen ── */
  startRow:    { flexDirection:'row', width:'100%', flex:1, alignItems:'center', paddingHorizontal:44 },
  startLeft:   { flex:1, alignItems:'center', justifyContent:'center' },
  startRight:  { flex:1, alignItems:'stretch', justifyContent:'center', gap:12, paddingLeft:36 },
  startBtnRow: { flexDirection:'row', gap:12 },

  logoImg:   { width:280, height:200, marginBottom:8 },

  swordIcon: { fontSize:48, marginBottom:10 },
  mainTitle: {
    fontFamily:'AvenirNext-Heavy', fontSize:58, color:'#fff',
    letterSpacing:12, lineHeight:64,
    textShadowColor:'rgba(240,192,64,0.5)', textShadowOffset:{width:0,height:0}, textShadowRadius:18,
  },
  runeRow:  { flexDirection:'row', gap:8, marginVertical:10 },
  rune:     { color:GOLD, fontSize:16, opacity:0.5 },
  tagline:  { fontFamily:'AvenirNext-Heavy', fontSize:11, color:GOLD, letterSpacing:10, opacity:0.6, marginTop:4 },

  playBtn: {
    borderWidth:2, borderColor:GOLD,
    paddingVertical:16, paddingHorizontal:24, borderRadius:2,
    backgroundColor:'rgba(240,192,64,0.1)', alignItems:'center',
  },
  playTxt: { fontFamily:'AvenirNext-Heavy', color:GOLD, fontSize:17, letterSpacing:6 },

  survivalBtn: {
    flex:1, borderWidth:2, borderColor:'#b03030',
    paddingVertical:13, paddingHorizontal:8, borderRadius:2,
    backgroundColor:'rgba(176,48,48,0.14)', alignItems:'center',
  },
  survivalTxt: { fontFamily:'AvenirNext-Heavy', color:'#e05050', fontSize:12, letterSpacing:3 },

  shopBtn: {
    flex:1, borderWidth:2, borderColor:'rgba(240,192,64,0.45)',
    paddingVertical:13, paddingHorizontal:8, borderRadius:2,
    backgroundColor:'rgba(240,192,64,0.07)', alignItems:'center',
  },
  shopTxt: { fontFamily:'AvenirNext-Heavy', color:GOLD, fontSize:12, letterSpacing:3 },

  walletBtn:          { borderWidth:1, borderColor:'rgba(240,192,64,0.35)', paddingVertical:11, paddingHorizontal:20, borderRadius:2, alignItems:'center' },
  walletBtnConnected: { borderColor:'#3ddc84', backgroundColor:'rgba(61,220,132,0.08)' },
  walletTxt:          { fontFamily:'AvenirNext-Heavy', color:'rgba(240,192,64,0.65)', fontSize:11, letterSpacing:4 },
  walletTxtConnected: { color:'#3ddc84' },

  versionTxt: { position:'absolute', bottom:18, right:22, fontFamily:'AvenirNext-Medium', color:GOLD, fontSize:9, opacity:0.25, letterSpacing:3 },

  /* Close button */
  closeBtn: { position:'absolute', top:18, right:18, width:36, height:36, borderRadius:18, backgroundColor:'rgba(0,0,0,0.7)', alignItems:'center', justifyContent:'center', borderWidth:1, borderColor:'rgba(255,255,255,0.15)' },
  closeTxt: { color:'#fff', fontSize:15, fontWeight:'800' },

  /* Screen header */
  csHeader:    { flexDirection:'row', alignItems:'center', width:'100%', paddingHorizontal:20, paddingVertical:10, borderBottomWidth:1, borderColor:'rgba(240,192,64,0.12)', marginBottom:8 },
  backBtn:     { width:76 },
  backTxt:     { fontFamily:'AvenirNext-Heavy', color:GOLD, fontSize:13, letterSpacing:3 },
  csTitleWrap: { flex:1, alignItems:'center' },
  csEyebrow:   { fontFamily:'AvenirNext-Medium', color:GOLD, fontSize:9, letterSpacing:7, opacity:0.55 },
  csTitle:     { fontFamily:'AvenirNext-Heavy', color:'#fff', fontSize:26, letterSpacing:8, textShadowColor:'rgba(240,192,64,0.3)', textShadowOffset:{width:0,height:0}, textShadowRadius:10 },

  /* Character cards */
  cardsRow:       { flexDirection:'row', gap:14, paddingHorizontal:20, flex:1, alignItems:'center' },
  card:           { flex:1, alignItems:'center', paddingVertical:20, borderWidth:1, borderColor:'rgba(240,192,64,0.15)', borderRadius:4, backgroundColor:'rgba(255,255,255,0.02)', overflow:'hidden' },
  cardActive:     { borderColor:GOLD, borderWidth:2, backgroundColor:GOLD_D },
  cardGlow:       { ...StyleSheet.absoluteFill, backgroundColor:GOLD, opacity:0.05 },
  iconRing:       { width:66, height:66, borderRadius:33, backgroundColor:'rgba(255,255,255,0.04)', borderWidth:1, borderColor:'rgba(240,192,64,0.18)', alignItems:'center', justifyContent:'center', marginBottom:12 },
  iconRingActive: { backgroundColor:'rgba(240,192,64,0.1)', borderColor:GOLD, borderWidth:2 },
  cardIcon:       { fontSize:30 },
  cardName:       { fontFamily:'AvenirNext-Heavy', color:'rgba(240,192,64,0.4)', fontSize:12, letterSpacing:5 },
  cardNameActive: { color:GOLD },
  cardRole:       { fontFamily:'AvenirNext-Medium', color:'rgba(255,255,255,0.2)', fontSize:9, letterSpacing:4, marginTop:4 },
  cardRoleActive: { color:'rgba(240,192,64,0.65)' },
  activePip:      { marginTop:12, width:36, height:2, backgroundColor:GOLD, borderRadius:1 },

  /* Bottom detail strip */
  detailStrip: { flexDirection:'row', alignItems:'center', width:'100%', paddingHorizontal:24, paddingVertical:14, borderTopWidth:1, borderColor:'rgba(240,192,64,0.12)', gap:14 },
  detailIcon:  { fontSize:22 },
  detailName:  { fontFamily:'AvenirNext-Heavy', color:'#fff', fontSize:14, letterSpacing:4 },
  detailRole:  { fontFamily:'AvenirNext-Medium', color:GOLD, fontSize:9, letterSpacing:4, opacity:0.65, marginTop:3 },
  confirmBtn:  { marginLeft:'auto' as any, borderWidth:2, borderColor:GOLD, paddingVertical:13, paddingHorizontal:26, borderRadius:2, backgroundColor:'rgba(240,192,64,0.08)' },
  confirmTxt:  { fontFamily:'AvenirNext-Heavy', color:GOLD, fontSize:13, letterSpacing:4 },

  /* Weapon grid */
  weaponGrid:        { flexDirection:'row', flexWrap:'wrap', paddingHorizontal:14, paddingVertical:10, gap:10, justifyContent:'center' },
  weaponCard:        { width:'28%', alignItems:'center', paddingVertical:14, paddingHorizontal:6, borderWidth:1, borderColor:'rgba(240,192,64,0.15)', borderRadius:4, backgroundColor:'rgba(255,255,255,0.02)', overflow:'hidden' },
  weaponCardActive:  { borderColor:GOLD, borderWidth:2, backgroundColor:GOLD_D },
  weaponIcon:        { fontSize:24, marginBottom:6 },
  weaponLabel:       { fontFamily:'AvenirNext-Heavy', color:'rgba(240,192,64,0.4)', fontSize:9, letterSpacing:3, textAlign:'center' },
  weaponLabelActive: { color:GOLD },
  weaponDesc:        { fontFamily:'AvenirNext-Medium', color:'rgba(255,255,255,0.2)', fontSize:7, letterSpacing:2, marginTop:3, textAlign:'center' },
  weaponDescActive:  { color:'rgba(240,192,64,0.65)' },

  /* Map select */
  mapCardsRow:        { flexDirection:'row', gap:14, paddingHorizontal:20, flex:1, alignItems:'stretch', marginBottom:4 },
  mapCard:            { flex:1, borderRadius:4, borderWidth:1, borderColor:'rgba(240,192,64,0.15)', overflow:'hidden', backgroundColor:'#060810' },
  mapPreviewWrap:     { flex:1, position:'relative' },
  mapPreviewBadge:    { position:'absolute', top:10, left:10, paddingHorizontal:8, paddingVertical:3, borderRadius:2 },
  mapPreviewBadgeTxt: { fontFamily:'AvenirNext-Heavy', color:'#000', fontSize:9, letterSpacing:2 },
  mapCardInfo:        { paddingHorizontal:14, paddingVertical:10 },
  mapCardTitle:       { fontFamily:'AvenirNext-Heavy', color:'#fff', fontSize:14, letterSpacing:4, marginBottom:2 },
  mapCardSub:         { fontFamily:'AvenirNext-Medium', color:'rgba(255,255,255,0.35)', fontSize:9, letterSpacing:3, marginBottom:8 },
  mapTagsRow:         { flexDirection:'row', gap:6, flexWrap:'wrap' },
  mapTag:             { borderWidth:1, borderColor:'rgba(240,192,64,0.22)', borderRadius:2, paddingHorizontal:6, paddingVertical:2 },
  mapTagTxt:          { fontFamily:'AvenirNext-Medium', color:'rgba(240,192,64,0.45)', fontSize:7, letterSpacing:2 },
});
