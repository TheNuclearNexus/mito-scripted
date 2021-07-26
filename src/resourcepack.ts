import * as fs from 'fs';
import * as util from './util'
import { argv } from '.';
import * as linq from 'linq-es5'



let dir: fs.Dir = null
let validResourcepacks: string[] = []
let resourcepacks: util.Pack[] = []
let folder: string

export function runResourcepack(path: string) {
    path = path.split('\\').join('/')
    folder = path
    if(util.dirExists(path)) {
        dir = fs.opendirSync(path)
        handleInput()
    }    
}


function getFiles(path: string, namespace: util.Namespace) : string[] {
    let files: string[] = []
   
    util.readDir(path, (entry) => {
        if(entry.isDirectory()) {
            files = files.concat(getFiles(path + "/" + entry.name, namespace))
        }
        else if(entry.isFile()) {
            files.push(path + "/" + entry.name)
        }
    })

    return files;

}

function getNamespace(path: string) : [string, util.Namespace] {
    var segments = path.split('/')
    let namespace = new util.Namespace()
    
    util.readDir(path, (entry) => {
        if(entry.isDirectory()) {
            namespace.data[entry.name] = getFiles(path + `/${entry.name}`, namespace)
        }
    })

    return [segments[segments.length - 1], namespace]
}


function createResourcepack(path: string) : util.Pack {

    let segments = path.split('/') 
    let resourcepack: util.Pack = new util.Pack(segments[segments.length - 1])

    util.readDir(path + "/assets", entry => {
        if(entry.isDirectory()) {
            var n = getNamespace(path + "/assets/" + entry.name)
            resourcepack.namespaces[n[0]] = n[1]
        }
    })

    return resourcepack
}

function handleInput() {    
    util.getValidPacks(dir).forEach(element => {
        let r: util.Pack = createResourcepack(element)
        resourcepacks.push(r)
    });

    let conflicts = util.buildFinalPack(resourcepacks, folder, 'resourcepack', (n : string, f : string, outPath : string, file : string, conflicts : util.ConflictDict) => {
        if (f == 'lang') {
            try {
                let lang1 = JSON.parse(fs.readFileSync(outPath).toString())
                let lang2 = JSON.parse(fs.readFileSync(file).toString())

                for(let l in lang2) {
                    if(lang1[l] == null) {
                        lang1[l] = lang2[l]
                    }
                }
                fs.writeFileSync(outPath, JSON.stringify(lang1, null, 2))
            } catch {
                console.log('[Merger-RP] Encountered an error while merging a lang file!')
            }
        } else if(f == 'models') {
            if(util.getExtension(outPath) == 'json') {
                let m1 = JSON.parse(fs.readFileSync(outPath).toString())
                let m2 = JSON.parse(fs.readFileSync(file).toString())

                if(m1["overrides"] != null && m2["overrides"] != null) {
                    let o = linq.AsEnumerable(m1["overrides"].concat(m2["overrides"]))
                    o = o
                        .OrderBy(model => model["predicate"]["custom_model_data"])
                        .ThenBy(model => model["predicate"]["damage"])
                        .ThenBy(model => model["predicate"]["damaged"])
                        .ThenBy(model => model["predicate"]["pull"])
                        .ThenBy(model => model["predicate"]["pulling"])
                        .ThenBy(model => model["predicate"]["time"])
                        .ThenBy(model => model["predicate"]["cooldown"])
                        .ThenBy(model => model["predicate"]["angle"])
                        .ThenBy(model => model["predicate"]["firework"])
                        .ThenBy(model => model["predicate"]["blocking"])
                        .ThenBy(model => model["predicate"]["broken"])
                        .ThenBy(model => model["predicate"]["cast"])
                        .ThenBy(model => model["predicate"]["lefthanded"])
                        .ThenBy(model => model["predicate"]["throwing"])
                        .ThenBy(model => model["predicate"]["charged"])

                    m1["overrides"] = o.ToArray()
                    fs.writeFileSync(outPath, JSON.stringify(m1, null, 2))
                } else if(m1["overrides"] == null) {
                    m1["overrides"] = m2["overrides"]
                    fs.writeFileSync(outPath, JSON.stringify(m1, null, 2))
                }
            }
        } else {
            conflicts[outPath].push(file)
        }
    })

 
    let f : number = fs.openSync('output/resourcepack/conflicts.yaml', 'w')

    let numberOfConflicts = 0

    for(let c in conflicts) {
        if(conflicts[c].length > 1) {
            fs.appendFileSync(f, `${c.replace('output/resourcepack/assets/', '')}:\n`)
            conflicts[c].forEach(file => {
                fs.appendFileSync(f, ` - ${file.replace(folder, '')}\n`)
            })
            numberOfConflicts++
        }
    }

    if(numberOfConflicts > 0)
        console.log(`[Merger-RP] Found ${numberOfConflicts} conflict${numberOfConflicts > 1 ? 's' : ''}, listed in 'output/resourcepack/conflicts.yaml'`)
    else
        console.log(`[Merger-RP] Successfully merged with 0 conflicts!`)
    fs.closeSync(f)
}




