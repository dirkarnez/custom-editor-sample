declare module "edge" {
	// export class <class name> {
	//    constructor();
 
	//    method(): void;
	// }
 
	export function func(element: string): (args: any, callback: (err: Error | undefined, result: any) => void) => void;
 }
