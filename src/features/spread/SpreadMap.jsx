import { spreadPlaces } from '../../data/spread.js';

// An original schematic coastline for this collection, without political
// boundaries or travel routes. All pins use the same simple projection.
const coastlines = [
  'M82 82 108 61 145 48 188 52 215 43 251 60 276 77 301 78 328 99 325 122 307 131 299 157 278 172 261 190 238 195 224 217 199 218 184 198 172 182 150 169 136 145 127 118 102 105 91 111 77 99Z',
  'M289 54 307 33 334 31 354 48 343 73 321 86 301 76Z',
  'M228 219 242 220 248 235 262 241 270 257 286 263 282 271 263 258 252 250 242 236Z',
  'M281 263 302 258 329 274 349 292 371 298 383 320 377 344 362 362 350 389 336 405 325 429 309 452 298 438 295 407 286 381 281 347 266 318 269 293Z',
  'M453 154 464 136 479 132 489 115 510 109 523 94 543 102 549 118 570 117 590 103 620 91 649 89 669 78 708 83 739 74 773 87 809 86 837 99 873 101 897 120 932 120 954 138 941 153 913 151 899 167 876 178 864 201 843 211 825 227 805 222 800 207 781 201 771 215 754 213 739 193 724 187 716 207 698 223 690 214 682 189 664 181 647 185 629 174 609 172 592 165 583 180 564 179 548 160 532 158 520 169 508 159 495 169 474 161Z',
  'M508 172 532 175 552 189 560 206 578 216 585 236 575 259 562 276 554 300 537 323 517 316 505 295 494 276 483 249 465 236 457 213 473 193 492 189Z',
  'M573 284 582 296 576 322 569 331 564 311Z',
  'M779 214 789 227 795 245 787 252 780 241 773 230Z',
  'M787 258 811 267 832 270 850 278 837 283 813 277 791 269Z',
  'M821 229 836 238 840 257 830 263 821 248Z',
  'M884 178 894 164 900 170 892 190 880 203 875 196Z',
  'M846 341 868 328 886 333 900 323 915 337 933 346 941 372 929 394 904 404 884 392 861 396 846 380 832 370 836 353Z',
  'M960 389 968 399 961 419 948 427 952 410Z',
  'M91 459 148 452 205 461 263 454 322 464 378 452 433 461 489 450 541 458 598 454 657 462 714 454 768 461 827 452 887 458 937 451 957 474 917 484 862 478 812 488 748 479 681 488 616 481 554 488 493 482 432 489 373 483 310 489 251 482 190 488 130 482 85 475Z',
];

const position = ([longitude, latitude]) => [(longitude + 180) / 360 * 1000, (90 - latitude) / 180 * 500];

export default function SpreadMap({ activeId, onSelect }) {
  return <section className="spread-map" aria-labelledby="spreadMapTitle">
    <div className="spread-map-heading">
      <h3 id="spreadMapTitle">所收录案例分布示意</h3>
      <span>五地 · 八幅实景</span>
    </div>
    <div className="spread-world">
      <svg className="spread-world-svg" viewBox="0 0 1000 500" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="spreadLandInk" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#b3a286" stopOpacity=".34" />
            <stop offset=".55" stopColor="#9d8a6c" stopOpacity=".24" />
            <stop offset="1" stopColor="#b8a484" stopOpacity=".36" />
          </linearGradient>
        </defs>
        <g className="spread-coastlines">{coastlines.map((path, index) => <path d={path} key={index} />)}</g>
        <g className="spread-pin-lines">{spreadPlaces.map(place => {
          const [x, y] = position(place.coordinates);
          return <path key={place.id} data-selected={activeId === place.id} d={`M${x} ${y}L${place.labelPosition[0]} ${place.labelPosition[1]}`} />;
        })}</g>
        <g className="spread-pins">{spreadPlaces.map(place => {
          const [x, y] = position(place.coordinates);
          return <g key={place.id} data-selected={activeId === place.id}>
            <circle className="spread-pin-halo" cx={x} cy={y} r="13" />
            <circle className="spread-pin-dot" cx={x} cy={y} r="5" />
          </g>;
        })}</g>
      </svg>
      <div className="spread-map-buttons" role="group" aria-label="选择案例地点">
        {spreadPlaces.map(place => <button key={place.id} type="button"
          className="spread-map-place" data-place={place.id} aria-pressed={activeId === place.id}
          aria-label={`选择${place.name}案例`} aria-controls="spreadPlaceCard"
          style={{ left: `${place.labelPosition[0] / 10}%`, top: `${place.labelPosition[1] / 5}%` }}
          onClick={() => onSelect(place.id)}>
          <span className="spread-map-place-dot" aria-hidden="true" />{place.name}
        </button>)}
      </div>
      <span className="spread-ocean spread-ocean--pacific" aria-hidden="true">太 平 洋</span>
      <span className="spread-ocean spread-ocean--atlantic" aria-hidden="true">大 西 洋</span>
      <span className="spread-ocean spread-ocean--indian" aria-hidden="true">印 度 洋</span>
    </div>
    <p className="spread-map-note">点击地点，走近一场实景。地图仅作案例索引，拍摄年份不表示传播先后。</p>
  </section>;
}
