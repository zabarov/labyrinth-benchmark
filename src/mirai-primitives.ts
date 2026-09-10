// General-purpose bounded pure operations, not a maze interpreter or oracle.
const integer=(value:unknown):number=>{if(!Number.isSafeInteger(value))throw new Error('invalid_integer');return value as number;};
export const primitives={
  multiply(args:Record<string,unknown>){return integer(integer(args.left)*integer(args.right));},
  modulo(args:Record<string,unknown>){const divisor=integer(args.right);if(divisor<=0)throw new Error('invalid_divisor');return ((integer(args.left)%divisor)+divisor)%divisor;},
  append(args:Record<string,unknown>){if(!Array.isArray(args.items)||args.items.length>=1000)throw new Error('list_limit');return [...args.items,structuredClone(args.value)];},
  record(args:Record<string,unknown>){if(JSON.stringify(args).length>4096)throw new Error('record_limit');return structuredClone(args);}
};
