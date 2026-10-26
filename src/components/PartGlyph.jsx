/** Navigation illustrations; scientific diagrams live in ResearchVisuals. */
export default function PartGlyph({ id }) {
  const common = { fill: 'none', stroke: 'currentColor', strokeWidth: 0.8 };
  return <svg viewBox="0 0 120 64" aria-hidden="true" {...common}>
    {id === 'brows' && <g><ellipse cx="44" cy="35" rx="23" ry="17"/><ellipse cx="44" cy="35" rx="16" ry="12"/><ellipse cx="44" cy="35" rx="8" ry="7"/><path d="M13 27Q39-2 68 25M68 25Q89 0 108 22"/><path d="M16 24Q39 5 66 23M76 24Q90 10 104 23" opacity=".4"/><path d="M44 9V60M15 35H75" strokeDasharray="2 3" opacity=".4"/></g>}
    {id === 'crown' && <g>{[0,1,2].map(i => <ellipse key={i} cx="60" cy={42-i*12} rx={35-i*9} ry={11-i*2}/>)}<path d="M60 3V61M22 43L60 10L98 43M33 35L60 58L87 35" strokeDasharray="2 3" opacity=".5"/><circle cx="60" cy="8" r="4"/></g>}
    {id === 'beard' && <g>{Array.from({length:11},(_,i) => <path key={i} d={`M${27+i*6} 7 C${8+i*8} 23 ${40+i*5} 30 ${39+i*4} 57`} opacity={0.35+ i/18}/>)}</g>}
    {id === 'body' && <g transform="translate(22,6)">{Array.from({length:3},(_,y)=>Array.from({length:4},(_,x)=><g key={`${x}-${y}`} transform={`translate(${x*21},${y*17})`}><path d="M0 8L8 0L16 8L8 16Z"/><circle cx="8" cy="8" r="3"/></g>))}</g>}
    {id === 'trim' && <g>{Array.from({length:6},(_,i)=><path key={i} d={`M9 ${15+i*6}C27 ${i*6-5} 38 ${40+i*6} 60 ${19+i*6}S90 ${i*6} 112 ${15+i*6}`} opacity={1-i*.11}/>)}</g>}
    {id === 'mouth' && <g><path d="M18 19Q60 35 102 19L94 31Q60 42 26 31Z M25 42Q60 65 95 42L90 51Q60 70 30 51Z"/>{[34,45,56,67,78,89].map(x=><path key={x} d={`M${x} 24V34M${x} 48V57`}/>)}<path d="M13 37H108" opacity=".4" strokeDasharray="2 3"/></g>}
  </svg>;
}
