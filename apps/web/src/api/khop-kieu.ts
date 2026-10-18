import ts from 'typescript';

// CHỈ DÙNG CHO BÀI THỬ (khop-hop-dong.test.ts, khop-kieu.test.ts) — giao diện không import tệp này.
//
// Đọc khai báo kiểu trong src/api/types.ts bằng trình biên dịch TypeScript lúc chạy bài thử, đổi thành "khuôn" thuần JS,
// rồi so dữ liệu JSON máy chủ trả về với khuôn đó: đủ/thừa tên trường VÀ kiểu giá trị (string/number/boolean/null/mảng/
// đối tượng), giá trị liệt kê ('DRAFT' | 'CONFIRMED'...), trường khai IsoDateTime phải là chuỗi ngày giờ đọc được,
// trường khai Vnd phải là số nguyên. Khuôn sinh thẳng từ types.ts nên sửa một kiểu ở đó (vd string → number) là bài đỏ —
// không có bản chép tay thứ hai để quên sửa.

export type Kieu =
  | { k: 'any' }
  | { k: 'string'; values: string[] | null; iso: boolean }
  | { k: 'number'; values: number[] | null; int: boolean }
  | { k: 'boolean'; values: boolean[] | null }
  | { k: 'null' }
  | { k: 'undefined' }
  | { k: 'array'; of: Kieu }
  | { k: 'object'; props: Record<string, { kieu: Kieu; optional: boolean }>; index: Kieu | null }
  | { k: 'union'; of: Kieu[] };

// Tên kiểu tiện ích có sẵn của TypeScript — không import từ types.ts.
const BUILTIN = new Set(['NonNullable', 'Pick', 'Omit', 'Partial', 'Required', 'Readonly', 'Record', 'Exclude', 'Extract', 'Array', 'Awaited', 'ReturnType']);
// "ham:catalog.getService" = kiểu giá trị mà HÀM GỌI catalog.getService (src/api/catalog.ts) hứa trả về.
const HAM = /^ham:([a-z][A-Za-z0-9_-]*)\.([A-Za-z0-9_]+)$/;

function formatDiagnostics(diags: readonly ts.Diagnostic[]): string {
  return diags
    .map((d) => {
      const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
      if (!d.file || d.start === undefined) return msg;
      const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
      return `${d.file.fileName}:${line + 1}:${character + 1} ${msg}`;
    })
    .join('\n');
}

/**
 * Nạp khuôn cho từng biểu thức kiểu (viết như trong TypeScript, dùng tên xuất từ types.ts),
 * vd. { detail: 'ContractDetail', quoteLine: 'GroupedContractLine<null>', items: 'Page<Service>' },
 * hoặc kiểu trả về của một hàm gọi cùng thư mục: { svc: 'ham:catalog.getService' }.
 * typesFile: đường dẫn tuyệt đối tới types.ts; tsconfigFile: tsconfig của web (để đọc @makeup/shared đúng cách).
 * Biểu thức sai tên hoặc types.ts có lỗi biên dịch → ném lỗi (lỗi kiểu biến thành "any" sẽ làm bài xanh giả).
 */
export function napKieu<const E extends Record<string, string>>(typesFile: string, tsconfigFile: string, exprs: E): { [K in keyof E]: Kieu } {
  const cfg = ts.readConfigFile(tsconfigFile, (f) => ts.sys.readFile(f));
  if (cfg.error) throw new Error(formatDiagnostics([cfg.error]));
  const dir = typesFile.replace(/[\\/][^\\/]+$/, '');
  const parsed = ts.parseJsonConfigFileContent(cfg.config, ts.sys, tsconfigFile.replace(/[\\/][^\\/]+$/, ''));
  const options: ts.CompilerOptions = { ...parsed.options, noEmit: true };

  const modules = new Set<string>();
  const entries = Object.entries(exprs).map(([key, expr]): [string, string] => {
    const m = HAM.exec(expr);
    if (!m) return [key, expr];
    modules.add(m[1] as string);
    return [key, `Awaited<ReturnType<typeof ${(m[1] as string).replace(/-/g, '_')}.${m[2] as string}>>`];
  });
  const names = new Set<string>();
  for (const [, expr] of entries) {
    for (const m of expr.replace(/typeof [\w.]+/g, '').matchAll(/\b[A-Z][A-Za-z0-9_]*\b/g)) if (!BUILTIN.has(m[0])) names.add(m[0]);
  }
  const base = typesFile.replace(/^.*[\\/]/, '').replace(/\.ts$/, '');
  const probePath = `${dir}/__khop_kieu_probe__.ts`;
  const probeText =
    (names.size > 0 ? `import type { ${[...names].join(', ')} } from './${base}';\n` : '') +
    [...modules].map((mod) => `import type * as ${mod.replace(/-/g, '_')} from './${mod}';\n`).join('') +
    entries.map(([, expr], i) => `export type __K${i} = ${expr};\n`).join('');

  const host = ts.createCompilerHost(options, true);
  const realGet = host.getSourceFile.bind(host);
  host.getSourceFile = (fileName, lang, onError, shouldCreate) =>
    fileName === probePath ? ts.createSourceFile(fileName, probeText, lang, true) : realGet(fileName, lang, onError, shouldCreate);
  const realExists = host.fileExists.bind(host);
  host.fileExists = (f) => f === probePath || realExists(f);
  const realRead = host.readFile.bind(host);
  host.readFile = (f) => (f === probePath ? probeText : realRead(f));

  const program = ts.createProgram({ rootNames: [probePath], options, host });
  const probe = program.getSourceFile(probePath);
  const typesSf = program.getSourceFile(typesFile);
  if (!probe || !typesSf) throw new Error(`Không nạp được ${typesFile}`);
  const checked = [probe, typesSf, ...[...modules].map((mod) => program.getSourceFile(`${dir}/${mod}.ts`))];
  const diags = checked.flatMap((sf) => (sf ? ts.getPreEmitDiagnostics(program, sf) : []));
  if (diags.length > 0) throw new Error(`Không đọc được kiểu để so (sửa lỗi biên dịch trước):\n${formatDiagnostics(diags)}\n--- biểu thức:\n${probeText}`);

  const checker = program.getTypeChecker();
  const out: Record<string, Kieu> = {};
  const aliases = probe.statements.filter(ts.isTypeAliasDeclaration);
  entries.forEach(([key, expr], i) => {
    const decl = aliases.find((a) => a.name.text === `__K${i}`);
    const sym = decl && checker.getSymbolAtLocation(decl.name);
    if (!sym) throw new Error(`Không tìm thấy kiểu ${expr}`);
    out[key] = toKieu(checker, checker.getDeclaredTypeOfSymbol(sym), expr, 0);
  });
  return out as { [K in keyof E]: Kieu };
}

// Gộp các nhánh của một union: chữ/số/boolean cụ thể gộp thành MỘT nhánh có danh sách giá trị; "string" trơn nuốt các chữ cụ thể.
function literalUnion(parts: Kieu[]): Kieu {
  const rest: Kieu[] = [];
  const str = { seen: false, any: false, values: new Set<string>(), iso: true };
  const num = { seen: false, any: false, values: new Set<number>(), int: true };
  const bool = new Set<boolean>();
  let hasAny = false;
  for (const p of parts) {
    if (p.k === 'any') hasAny = true;
    else if (p.k === 'undefined') continue;
    else if (p.k === 'string') {
      str.seen = true;
      str.iso &&= p.iso;
      if (p.values) for (const v of p.values) str.values.add(v);
      else str.any = true;
    } else if (p.k === 'number') {
      num.seen = true;
      num.int &&= p.int;
      if (p.values) for (const v of p.values) num.values.add(v);
      else num.any = true;
    } else if (p.k === 'boolean') for (const v of p.values ?? [true, false]) bool.add(v);
    else if (p.k === 'union') rest.push(...p.of);
    else rest.push(p);
  }
  if (hasAny) return { k: 'any' };
  const of: Kieu[] = [];
  if (str.seen) of.push({ k: 'string', values: str.any ? null : [...str.values].sort(), iso: str.iso });
  if (num.seen) of.push({ k: 'number', values: num.any ? null : [...num.values], int: num.int });
  if (bool.size > 0) of.push({ k: 'boolean', values: bool.size === 2 ? null : [...bool] });
  of.push(...rest);
  if (of.length === 0) return { k: 'undefined' };
  return of.length === 1 ? (of[0] as Kieu) : { k: 'union', of };
}

// Trường khai trực tiếp bằng IsoDateTime / Vnd (có thể kèm | null): ghi nhớ để kiểm thêm định dạng.
function declaredFormat(prop: ts.Symbol): { iso: boolean; int: boolean } {
  const decl = prop.valueDeclaration ?? prop.declarations?.[0];
  if (!decl || !ts.isPropertySignature(decl) || !decl.type) return { iso: false, int: false };
  const parts = ts.isUnionTypeNode(decl.type) ? decl.type.types : [decl.type];
  const refs: string[] = [];
  for (const p of parts) if (ts.isTypeReferenceNode(p)) refs.push(p.typeName.getText());
  const simple = parts.every((p) => ts.isTypeReferenceNode(p) || (ts.isLiteralTypeNode(p) && p.literal.kind === ts.SyntaxKind.NullKeyword));
  return { iso: simple && refs.includes('IsoDateTime'), int: simple && refs.includes('Vnd') };
}

function withFormat(k: Kieu, f: { iso: boolean; int: boolean }): Kieu {
  if (k.k === 'string' && f.iso) return { ...k, iso: true };
  if (k.k === 'number' && f.int) return { ...k, int: true };
  if (k.k === 'union') return { k: 'union', of: k.of.map((x) => withFormat(x, f)) };
  return k;
}

function toKieu(checker: ts.TypeChecker, t: ts.Type, where: string, depth: number): Kieu {
  if (depth > 40) throw new Error(`${where}: kiểu lồng quá sâu (đệ quy?)`);
  const f = t.getFlags();
  if (f & (ts.TypeFlags.Any | ts.TypeFlags.Unknown)) return { k: 'any' };
  if (t.isUnion()) return literalUnion(t.types.map((m) => toKieu(checker, m, where, depth + 1)));
  if (t.isStringLiteral()) return { k: 'string', values: [t.value], iso: false };
  if (f & (ts.TypeFlags.String | ts.TypeFlags.TemplateLiteral | ts.TypeFlags.StringMapping)) return { k: 'string', values: null, iso: false };
  if (t.isNumberLiteral()) return { k: 'number', values: [t.value], int: false };
  if (f & ts.TypeFlags.Number) return { k: 'number', values: null, int: false };
  if (f & ts.TypeFlags.BooleanLiteral) return { k: 'boolean', values: [checker.typeToString(t) === 'true'] };
  if (f & ts.TypeFlags.Boolean) return { k: 'boolean', values: null };
  if (f & ts.TypeFlags.Null) return { k: 'null' };
  if (f & (ts.TypeFlags.Undefined | ts.TypeFlags.Void)) return { k: 'undefined' };
  if (f & ts.TypeFlags.Never) throw new Error(`${where}: kiểu never — dữ liệu nào cũng sai`);
  if (t.isIntersection()) {
    const prim = t.types.find((m) => m.getFlags() & (ts.TypeFlags.StringLike | ts.TypeFlags.NumberLike | ts.TypeFlags.BooleanLike));
    if (prim) return toKieu(checker, prim, where, depth + 1);
  }
  if (checker.isArrayType(t) || checker.isTupleType(t)) {
    const args = checker.getTypeArguments(t as ts.TypeReference);
    return { k: 'array', of: literalUnion(args.map((a) => toKieu(checker, a, `${where}[]`, depth + 1))) };
  }
  if (f & ts.TypeFlags.Object || t.isIntersection()) {
    if (t.getCallSignatures().length > 0) throw new Error(`${where}: kiểu hàm không có trong JSON`);
    const props: Record<string, { kieu: Kieu; optional: boolean }> = {};
    for (const p of checker.getPropertiesOfType(t)) {
      const pt = checker.getTypeOfSymbol(p);
      props[p.name] = {
        kieu: withFormat(toKieu(checker, pt, `${where}.${p.name}`, depth + 1), declaredFormat(p)),
        optional: (p.flags & ts.SymbolFlags.Optional) !== 0,
      };
    }
    const idx = checker.getIndexInfosOfType(t).find((i) => i.keyType.getFlags() & ts.TypeFlags.String);
    return { k: 'object', props, index: idx ? toKieu(checker, idx.type, `${where}[string]`, depth + 1) : null };
  }
  throw new Error(`${where}: chưa so được kiểu ${checker.typeToString(t)}`);
}

export function loaiCua(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export function moTa(k: Kieu): string {
  switch (k.k) {
    case 'string':
      return k.values ? k.values.map((v) => JSON.stringify(v)).join(' | ') : k.iso ? 'string (ISO 8601)' : 'string';
    case 'number':
      return k.values ? k.values.join(' | ') : k.int ? 'number (số nguyên)' : 'number';
    case 'boolean':
      return k.values ? k.values.join(' | ') : 'boolean';
    case 'array':
      return `array<${moTa(k.of)}>`;
    case 'object':
      return `object{${Object.keys(k.props).join(',')}}`;
    case 'union':
      return k.of.map(moTa).join(' | ');
    default:
      return k.k;
  }
}

/** So một giá trị với khuôn; trả danh sách lỗi (rỗng = khớp). */
export function soKieu(v: unknown, k: Kieu, path: string): string[] {
  const errs: string[] = [];
  const bad = (msg: string) => errs.push(`${path}: ${msg}`);
  switch (k.k) {
    case 'any':
      break;
    case 'undefined':
      if (v !== undefined) bad(`cần không có giá trị, nhận ${loaiCua(v)}`);
      break;
    case 'null':
      if (v !== null) bad(`cần null, nhận ${loaiCua(v)} ${JSON.stringify(v)}`);
      break;
    case 'string':
      if (typeof v !== 'string') bad(`cần ${moTa(k)}, nhận ${loaiCua(v)} ${JSON.stringify(v)}`);
      else if (k.values && !k.values.includes(v)) bad(`giá trị ${JSON.stringify(v)} không thuộc ${moTa(k)}`);
      else if (k.iso && (!/^\d{4}-\d{2}-\d{2}T/.test(v) || Number.isNaN(Date.parse(v)))) bad(`cần chuỗi ngày giờ ISO 8601, nhận ${JSON.stringify(v)}`);
      break;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) bad(`cần ${moTa(k)}, nhận ${loaiCua(v)} ${JSON.stringify(v)}`);
      else if (k.values && !k.values.includes(v)) bad(`giá trị ${v} không thuộc ${moTa(k)}`);
      else if (k.int && !Number.isSafeInteger(v)) bad(`cần số nguyên đồng, nhận ${v}`);
      break;
    case 'boolean':
      if (typeof v !== 'boolean') bad(`cần boolean, nhận ${loaiCua(v)} ${JSON.stringify(v)}`);
      else if (k.values && !k.values.includes(v)) bad(`giá trị ${v} không thuộc ${moTa(k)}`);
      break;
    case 'array':
      if (!Array.isArray(v)) bad(`cần array, nhận ${loaiCua(v)}`);
      else v.forEach((x, i) => errs.push(...soKieu(x, k.of, `${path}[${i}]`)));
      break;
    case 'object': {
      if (loaiCua(v) !== 'object') {
        bad(`cần object, nhận ${loaiCua(v)} ${JSON.stringify(v)}`);
        break;
      }
      const o = v as Record<string, unknown>;
      for (const [name, p] of Object.entries(k.props)) {
        if (!(name in o)) {
          if (!p.optional) bad(`thiếu trường "${name}" (types.ts khai ${moTa(p.kieu)})`);
          continue;
        }
        errs.push(...soKieu(o[name], p.kieu, `${path}.${name}`));
      }
      for (const name of Object.keys(o)) {
        if (name in k.props) continue;
        if (k.index) errs.push(...soKieu(o[name], k.index, `${path}.${name}`));
        else bad(`thừa trường "${name}" (máy chủ trả ${loaiCua(o[name])}, types.ts không khai)`);
      }
      break;
    }
    case 'union': {
      let best: string[] | null = null;
      for (const m of k.of) {
        const e = soKieu(v, m, path);
        if (e.length === 0) return [];
        if (!best || e.length < best.length) best = e;
      }
      bad(`không khớp kiểu nào trong ${moTa(k)}`);
      errs.push(...(best ?? []));
      break;
    }
  }
  return errs;
}
