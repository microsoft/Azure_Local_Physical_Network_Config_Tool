# IP Subnet Planning Tool - Quick Guide

## What This Tool Does

🎯 **Automatically divides your network into subnets** - no manual calculations needed!

- Takes a big network (like `192.168.1.0/24`) 
- Splits it into smaller subnets based on your needs
- Shows you exactly what IP ranges to use
- Calculates everything automatically - no subnet math required!

---

## 🚀 Getting Started

### Step 1: Import the Module
```powershell
# Load the IP Management tool
Import-Module .\IPManagement.psm1
```

### Step 2: Get Help Anytime
```powershell
# See all available functions
Get-Command -Module IPManagement

# Get detailed help for any function
Get-Help New-SubnetPlanFromConfig -Examples
Get-Help New-SubnetPlanByHosts -Examples  
Get-Help New-SubnetPlan -Examples

# Get full documentation
Get-Help New-SubnetPlanFromConfig -Full
```

💡 **Pro Tip:** Always run `Get-Help [FunctionName] -Examples` to see more examples and detailed usage!

---

## Three Ways to Use It (Pick One)

### 🏆 **Option 1: JSON Configuration** (RECOMMENDED)
**Best for:** Real projects with named subnets

**When to use:** When you want professional documentation and have multiple subnets with names/VLANs/descriptions.

```powershell
# 1. Create a simple JSON file (save as network.json):
{
  "network": "192.168.1.0/24",
  "subnets": [
    { "name": "Management", "vlan": 101, "hosts": 30 },
    { "name": "Users", "vlan": 102, "hosts": 100 },
    { "name": "Servers", "vlan": 103, "hosts": 20 }
  ]
}

# 2. Run the command (network is now defined in JSON!):
New-SubnetPlanFromConfig -ConfigPath "network.json"

# Alternative: Override network from command line
New-SubnetPlanFromConfig -Network "10.0.1.0/24" -ConfigPath "network.json"
```

**Sample Output:**
```
Name       Vlan Subnet           Prefix Network       Broadcast     FirstHost     EndHost       UsableHosts
----       ---- ------           ------ -------       ---------     ---------     -------       -----------
Users       102 192.168.1.0/25      25 192.168.1.0   192.168.1.127 192.168.1.1   192.168.1.126        126
Management  101 192.168.1.128/27    27 192.168.1.128 192.168.1.159 192.168.1.129 192.168.1.158         30
Servers     103 192.168.1.160/27    27 192.168.1.160 192.168.1.191 192.168.1.161 192.168.1.190         30
Available       192.168.1.192/26    26 192.168.1.192 192.168.1.255 192.168.1.193 192.168.1.254         62
```

**You get:** Professional table with subnet names, VLANs, IP ranges, and everything labeled clearly.

#### 🔧 **JSON Configuration Flexibility**

**Two ways to specify subnet sizes in JSON:**

**Option A: By Host Count** (most common)
```json
{
  "network": "192.168.1.0/24",
  "subnets": [
    { "name": "Management", "vlan": 101, "hosts": 30 },
    { "name": "DMZ", "vlan": 102, "hosts": 50 }
  ]
}
```

**Option B: By CIDR Prefix** (for network experts)
```json
{
  "network": "192.168.1.0/24", 
  "subnets": [
    { "name": "Management", "vlan": 101, "cidr": "27" },
    { "name": "DMZ", "vlan": 102, "cidr": "26" }
  ]
}
```

**Mixed Approach** (you can combine both in one file!)
```json
{
  "network": "192.168.1.0/24",
  "subnets": [
    { "name": "Management", "vlan": 101, "hosts": 30 },
    { "name": "DMZ", "vlan": 102, "cidr": "26" },
    { "name": "Servers", "vlan": 103, "hosts": 15 }
  ]
}
```

💡 **Pro Tip:** Use `hosts` when you know how many devices you need. Use `cidr` when you need exact subnet sizes.

---

### 🎯 **Option 2: Host Count** (SIMPLE)
**Best for:** Quick calculations

**When to use:** When you just know "I need X hosts" and want a fast answer.

```powershell
# "I need 2 subnets with 50 hosts each, and 1 subnet with 10 hosts"
New-SubnetPlanByHosts -Network "192.168.1.0/24" -HostRequirements @{ 50 = 2; 10 = 1 }
```

**Sample Output:**
```
Name     Subnet           Prefix Network       Broadcast     FirstHost     EndHost       UsableHosts
----     ------           ------ -------       ---------     ---------     -------       -----------
Assigned 192.168.1.0/26      26 192.168.1.0   192.168.1.63  192.168.1.1   192.168.1.62           62
Assigned 192.168.1.64/26     26 192.168.1.64  192.168.1.127 192.168.1.65  192.168.1.126          62
Assigned 192.168.1.128/28    28 192.168.1.128 192.168.1.143 192.168.1.129 192.168.1.142          14
Available 192.168.1.144/28   28 192.168.1.144 192.168.1.159 192.168.1.145 192.168.1.158          14
Available 192.168.1.160/27   27 192.168.1.160 192.168.1.191 192.168.1.161 192.168.1.190          30
Available 192.168.1.192/26   26 192.168.1.192 192.168.1.255 192.168.1.193 192.168.1.254          62
```

**You get:** Subnet ranges that fit your host requirements exactly.

---

### ⚙️ **Option 3: Technical Prefixes** (ADVANCED)
**Best for:** Network experts who know CIDR

**When to use:** When you know exactly what subnet sizes you want (like /26, /28).

```powershell
# "I need 2 /26 subnets and 3 /28 subnets"
New-SubnetPlan -Network "192.168.1.0/24" -PrefixRequirements @{ 26 = 2; 28 = 3 }
```

**Sample Output:**
```
Name      Subnet           Prefix Network       Broadcast     FirstHost     EndHost       UsableHosts
----      ------           ------ -------       ---------     ---------     -------       -----------
Assigned  192.168.1.0/26      26 192.168.1.0   192.168.1.63  192.168.1.1   192.168.1.62           62
Assigned  192.168.1.64/26     26 192.168.1.64  192.168.1.127 192.168.1.65  192.168.1.126          62
Assigned  192.168.1.128/28    28 192.168.1.128 192.168.1.143 192.168.1.129 192.168.1.142          14
Assigned  192.168.1.144/28    28 192.168.1.144 192.168.1.159 192.168.1.145 192.168.1.158          14
Assigned  192.168.1.160/28    28 192.168.1.160 192.168.1.175 192.168.1.161 192.168.1.174          14
Available 192.168.1.176/28    28 192.168.1.176 192.168.1.191 192.168.1.177 192.168.1.190          14
Available 192.168.1.192/26    26 192.168.1.192 192.168.1.255 192.168.1.193 192.168.1.254          62
```

**You get:** Precise control over subnet sizes with technical CIDR notation.