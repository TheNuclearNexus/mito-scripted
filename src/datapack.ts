import * as fs from 'fs';
import * as AdmZip from 'adm-zip'
import * as util from './util'
import { argv } from '.';
import LMT = require('./datapackTools/loot_table_merger')

class Datapack {
    name: string
    namespaces: util.NamespaceKey = {}
    constructor(name:string) {
        this.name = name
    }

    public toString() : string {
        let str : string = this.name + ":\n"

        for(let n in this.namespaces) {
            str += `\t${n}:\n${this.namespaces[n].toString()}`
        }


        return str
    }
}

let dir: fs.Dir = null
let validDatapacks: string[] = []
let datapacks: Datapack[] = []
let datapacksFolder: string

export function runDatapack(path: string) {
    path = path.split('\\').join('/')
    datapacksFolder = path
    if(util.dirExists(path)) {
        dir = fs.opendirSync(path)
        handleInput()
    }    
}

function handleInput() {
    util.getValidPacks(dir).forEach(element => {
        let d: Datapack = createDatapack(element)
        datapacks.push(d)
    });

    let conflicts = util.buildFinalPack(datapacks, datapacksFolder, 'datapack', (n : string, f : string, outPath : string, file : string, conflicts : util.ConflictDict) => {
        if(f == 'tags') {
            let tagA = JSON.parse(fs.readFileSync(outPath).toString())
            let tagB = JSON.parse(fs.readFileSync(file).toString())

            for(let i = 0; i < tagB["values"].length; i++) {
                if(!tagA["values"].includes(tagB["values"][i]))
                    tagA["values"].push(tagB["values"][i])
            }

            fs.writeFileSync(outPath, JSON.stringify(tagA, null, 2))
        } else {
            let strA = fs.readFileSync(outPath).toString()
            let strB = fs.readFileSync(file).toString()

            strA = strA.replace(/\s+/g, '')
            strB = strB.replace(/\s+/g, '')

            if(strA != strB) {
                conflicts[outPath].push(file)

                if(f == 'loot_tables' && argv.mergeLootTables == 'true') {
                    fs.writeFileSync(outPath, JSON.stringify(LMT.merge(outPath, file), null, 2))
                }
            }
        }
    })

    let f : number = fs.openSync('output/datapack/conflicts.yaml', 'w')

    let numberOfConflicts = 0

    for(let c in conflicts) {
        if(conflicts[c].length > 1) {
            if(c.includes('loot_tables/') && argv.mergeLootTables == 'true') {
                fs.appendFileSync(f, `[MERGED] ${c.replace('output/datapack/data/', '')}:\n`)
            } else {
                fs.appendFileSync(f, `${c.replace('output/datapack/data/', '')}:\n`)
            }
            conflicts[c].forEach(file => {
                fs.appendFileSync(f, ` - ${file.replace(datapacksFolder, '')}\n`)
            })
            numberOfConflicts++
        }
    }

    if(argv.mergeLootTables == 'true') {
        console.log(`[Merger-DP] Even though 'mergeLootTables' was enabled, the merger still causes bugs and the files should be check manually!`)
    }
    console.log(`[Merger-DP] Found ${numberOfConflicts} conflict${numberOfConflicts > 1 ? 's' : ''}, listed in 'output/datapack/conflicts.yaml'`)

    fs.closeSync(f)
}

function getFiles(path: string, ext: string, namespace: util.Namespace) : string[] {
    let files: string[] = []
   
    util.readDir(path, (entry) => {
        if(entry.isDirectory()) {
            files = files.concat(getFiles(path + "/" + entry.name, ext, namespace))
        }
        else if(entry.isFile()) {
            let parts = entry.name.split('.')

            if(parts[parts.length-1] == ext) {
                files.push(path + "/" + entry.name)
            }
        }
    })

    return files;

}

function getNamespace(path: string) : [string, util.Namespace] {
    var segments = path.split('/')
    let namespace = new util.Namespace()
    
    util.readDir(path, (entry) => {
        if(entry.isDirectory()) {
            let ext = 'json'
            if(entry.name == 'functions') ext = 'mcfunction'
            else if(entry.name == 'structures') ext = 'nbt'

            namespace.data[entry.name] = getFiles(path + `/${entry.name}`, ext, namespace)
        }
    })

    return [segments[segments.length - 1], namespace]
}

function createDatapack(path: string) : Datapack {

    let segments = path.split('/') 
    let datapack: Datapack = new Datapack(segments[segments.length - 1])

    util.readDir(path + "/data", entry => {
        if(entry.isDirectory()) {
            var n = getNamespace(path + "/data/" + entry.name)
            datapack.namespaces[n[0]] = n[1]
        }
    })

    return datapack
}

