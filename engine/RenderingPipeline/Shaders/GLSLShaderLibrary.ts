//fresnel
export const PointLightvsSource: WebGLShader = `
     #define MAX_POINT_LIGHTS 10

    attribute vec4 aPosition;
    attribute vec3 aVertexNormal;
    // attribute vec4 aVertexColor;
    attribute vec2 aTextureCoord;
    attribute vec3 aTangent;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;
    uniform highp vec3 uLightPosition[MAX_POINT_LIGHTS];
    uniform mat4 u_modelCameraMatrix;

    // varying lowp vec4 vColor;
    varying vec3 vNormal;
    varying vec4 vPosition;
    varying vec3 vWorldPos;
    varying vec2 vTextureCoord;
    varying vec3 vLightDirection[MAX_POINT_LIGHTS];
    varying vec3 vTangentLightDir[MAX_POINT_LIGHTS];
    varying vec3 vTangentViewDir;

    void main() {
        // Calculate world position
        vPosition = u_modelMatrix * aPosition;
        vWorldPos = vec3(vPosition);
        gl_Position = u_projectionMatrix * u_viewMatrix * u_modelCameraMatrix * vPosition;

        // Transform normal to world space and normalize
        vec3 normal = normalize(mat3(u_modelMatrix) * aVertexNormal);
        vNormal = normal;

        // Transform tangent to world space and normalize
        vec3 tangent = normalize(mat3(u_modelMatrix) * aTangent);

        // Ensure tangent is perpendicular to normal (Gram-Schmidt process)
        tangent = normalize(tangent - dot(tangent, normal) * normal);

        // Calculate bitangent from normal and tangent
        vec3 bitangent = normalize(cross(normal, tangent));

        // Create TBN matrix - manually create the matrix with vectors as columns
        mat3 TBN = mat3(
            tangent.x, bitangent.x, normal.x,
            tangent.y, bitangent.y, normal.y,
            tangent.z, bitangent.z, normal.z
        );

        // Pass texture coordinates to fragment shader
        vTextureCoord = aTextureCoord;

        // Extract camera position from view matrix
        vec3 viewTranslation = vec3(-u_viewMatrix[3][0], -u_viewMatrix[3][1], -u_viewMatrix[3][2]);
        vec3 camPos = vec3(
            u_viewMatrix[0][0] * viewTranslation.x + u_viewMatrix[1][0] * viewTranslation.y + u_viewMatrix[2][0] * viewTranslation.z,
            u_viewMatrix[0][1] * viewTranslation.x + u_viewMatrix[1][1] * viewTranslation.y + u_viewMatrix[2][1] * viewTranslation.z,
            u_viewMatrix[0][2] * viewTranslation.x + u_viewMatrix[1][2] * viewTranslation.y + u_viewMatrix[2][2] * viewTranslation.z
        );

        // Calculate view direction in world space
        vec3 viewDir = normalize(camPos - vWorldPos);

        // Transform view direction to tangent space
        vTangentViewDir = TBN * viewDir;

        // Calculate light directions for each point light
        for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
            // Calculate light direction in world space (direction from vertex to light)
            vec3 lightDir = normalize(uLightPosition[i] - vWorldPos);
            vLightDirection[i] = lightDir;

            // Transform light direction to tangent space
            vTangentLightDir[i] = TBN * lightDir;
        }
    }`;
export const PointLightfsSource: WebGLShader = `
    precision mediump float;
    #define MAX_POINT_LIGHTS 10

    varying vec3 vNormal;
    varying vec4 vPosition;
    varying vec3 vWorldPos;
    varying vec2 vTextureCoord;

    varying vec3 vLightDirection[MAX_POINT_LIGHTS];
    varying vec3 vTangentLightDir[MAX_POINT_LIGHTS];
    varying vec3 vTangentViewDir;

    uniform sampler2D uSampler;
    uniform sampler2D uNormalMap;

    uniform highp vec3 uLightPosition[MAX_POINT_LIGHTS];
    uniform float uLightRadius[MAX_POINT_LIGHTS];
    uniform float uPointLightIntensity[MAX_POINT_LIGHTS];
    uniform vec3 uPointLightColor[MAX_POINT_LIGHTS];

    uniform vec3 uColor;
    uniform vec3 uAmbientLightColor;
    uniform vec3 uSpecularLightColor;
    uniform vec3 uDiffuseLightColor;

    uniform float uRoughness;
    uniform float uMetallic;
    uniform float uSpecular;
    uniform float uAlpha;

    uniform bool uHasTexture;
    uniform bool uHasNormalMap;

    uniform vec3 uEmissionColor;
    uniform float uEmissionIntensity;

    // GGX Normal Distribution Function (NDF)
    float distributionGGX(vec3 N, vec3 H, float roughness) {
        float a = max(roughness * roughness, 0.001);
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        float num = a2;
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = 3.14159 * denom * denom;
        return num / denom;
    }

    // Fresnel-Schlick approximation
    vec3 fresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    }

    void main(void) {
        // Get base color from texture or uniform
        vec3 textureColor = texture2D(uSampler, vTextureCoord).rgb;
        vec3 baseColor = uHasTexture ? textureColor : uColor;

        // Start with ambient lighting
        vec3 finalColor = uAmbientLightColor * baseColor;

        // Determine normal based on normal map or vertex normal
        vec3 N;
        vec3 viewDir;

        if (uHasNormalMap) {
            // Sample normal map and convert from [0,1] to [-1,1] range
            vec3 normalMap = texture2D(uNormalMap, vTextureCoord).rgb;
            N = normalize(normalMap * 2.0 - 1.0);
            viewDir = normalize(vTangentViewDir);
        } else {
            // Use the world-space normal directly
            N = normalize(vNormal);
            // vTangentViewDir is actually view direction in tangent space if we passed it correctly, 
            // but for non-normal mapped we just need world-space view direction.
            // Let's use the tangent space one if it's available, otherwise it's just camPos - worldPos.
            viewDir = normalize(vTangentViewDir);
        }

        // Loop through all point lights
        for (int i = 0; i < MAX_POINT_LIGHTS; i++) {
            // Choose appropriate light direction based on whether we're using normal maps
            vec3 lightDir;

            if (uHasNormalMap) {
                // Use tangent space light direction with normal map
                lightDir = normalize(vTangentLightDir[i]);
            } else {
                // Use world space light direction without normal map
                lightDir = normalize(uLightPosition[i] - vWorldPos);
            }

            // Calculate distance for attenuation
            float distance = length(uLightPosition[i] - vWorldPos);

            // Calculate light attenuation
            float attenuation = uPointLightIntensity[i] / (1.0 + pow(distance / uLightRadius[i], 2.0));
            attenuation = clamp(attenuation, 0.0, 1.0);

            // Calculate half vector for specular
            vec3 H = normalize(lightDir + viewDir);

            // GGX distribution for specular reflection
            float D = distributionGGX(N, H, uRoughness);

            // Fresnel-Schlick for specular reflectance
            vec3 F0 = mix(vec3(0.04), baseColor, uMetallic);
            float NdotH = max(dot(N, H), 0.0);
            vec3 F = fresnelSchlick(NdotH, F0);

            // Diffuse lighting
            float NdotL = max(dot(N, lightDir), 0.0);
            vec3 diffuseColor = uDiffuseLightColor * uPointLightColor[i] * NdotL * attenuation * (1.0 - uMetallic);

            // Specular lighting
            float NdotV = max(dot(N, viewDir), 0.0);
            vec3 specularColor = D * F * NdotL * uSpecularLightColor * attenuation * uSpecular * (1.0 - uRoughness);

            // Add light contribution to final color
            finalColor += diffuseColor + specularColor;
        }

        // Apply emission color
        finalColor += uEmissionColor * uEmissionIntensity;

        // Output final color
        gl_FragColor = vec4(finalColor * baseColor, uAlpha);
}`;
export const SpotLightvsSource: WebGLShader = `
   #define MAX_SPOT_LIGHTS 10

attribute vec3 aPosition;
attribute vec3 aVertexNormal;
attribute vec4 aVertexColor;
attribute vec2 aTextureCoord;
attribute vec3 aTangent;

uniform mat4 u_modelMatrix;
uniform mat4 u_viewMatrix;
uniform mat4 u_projectionMatrix;
uniform mat4 u_modelCameraMatrix;

uniform highp vec3 uSpotLightPosition[MAX_SPOT_LIGHTS];

varying vec3 vNormal;
varying vec4 vPosition;
varying vec3 vWorldPos;
varying vec2 vTextureCoord;
varying vec3 vWorldNormal;

varying vec3 vTangentLightDir[MAX_SPOT_LIGHTS];
varying vec3 vTangentViewDir;
varying vec3 vWorldLightDir[MAX_SPOT_LIGHTS];

void main() {
    vPosition = u_modelMatrix * vec4(aPosition, 1.0);
    vWorldPos = vec3(vPosition);
    gl_Position = u_projectionMatrix * u_viewMatrix * u_modelCameraMatrix * vPosition;

    // World-space normal and tangent
    vec3 normal = normalize(mat3(u_modelMatrix) * aVertexNormal);
    vec3 tangent = normalize(mat3(u_modelMatrix) * aTangent);
    tangent = normalize(tangent - dot(tangent, normal) * normal); // Orthonormalize
    vec3 bitangent = normalize(cross(normal, tangent));
    
    mat3 TBN = mat3(
        tangent.x, bitangent.x, normal.x,
        tangent.y, bitangent.y, normal.y,
        tangent.z, bitangent.z, normal.z
    );

    vNormal = normal;
    vWorldNormal = normal; // Store world-space normal for light-side calculations
    vTextureCoord = aTextureCoord;

    // Extract world-space camera position from view matrix
    vec3 viewTranslation = vec3(-u_viewMatrix[3][0], -u_viewMatrix[3][1], -u_viewMatrix[3][2]);
    vec3 camPos = vec3(
        u_viewMatrix[0][0] * viewTranslation.x + u_viewMatrix[1][0] * viewTranslation.y + u_viewMatrix[2][0] * viewTranslation.z,
        u_viewMatrix[0][1] * viewTranslation.x + u_viewMatrix[1][1] * viewTranslation.y + u_viewMatrix[2][1] * viewTranslation.z,
        u_viewMatrix[0][2] * viewTranslation.x + u_viewMatrix[1][2] * viewTranslation.y + u_viewMatrix[2][2] * viewTranslation.z
    );

    vec3 viewDir = normalize(camPos - vWorldPos);
    vTangentViewDir = TBN * viewDir;

    for (int i = 0; i < MAX_SPOT_LIGHTS; i++) {
        vec3 lightDir = normalize(uSpotLightPosition[i] - vWorldPos);
        vTangentLightDir[i] = TBN * lightDir;
        vWorldLightDir[i] = lightDir; // Store world-space light direction
    }
    }`;
export const SpotLightfsSource: WebGLShader = `
   precision mediump float;
 #define MAX_SPOT_LIGHTS 10
 
 varying vec3 vNormal;
 varying vec4 vPosition;
 varying vec3 vWorldPos;
 varying vec2 vTextureCoord;
 varying vec3 vWorldNormal;
 
 varying vec3 vTangentLightDir[MAX_SPOT_LIGHTS];
 varying vec3 vTangentViewDir;
 varying vec3 vWorldLightDir[MAX_SPOT_LIGHTS];
 
 uniform sampler2D uTexture;
 uniform sampler2D uNormalMap;
 
 uniform bool uHasTexture;
 uniform bool uHasNormalMap;
 
 uniform highp vec3 uSpotLightPosition[MAX_SPOT_LIGHTS];
 uniform vec3 uSpotLightDirection[MAX_SPOT_LIGHTS];
 uniform float uSpotLightAngle[MAX_SPOT_LIGHTS];
 uniform float uSpotLightIntensity[MAX_SPOT_LIGHTS];
 uniform vec3 uSpotLightColor[MAX_SPOT_LIGHTS];
 
 uniform vec3 uColor;
 uniform vec3 uAmbientLightColor;
 uniform vec3 uSpecularLightColor;
 uniform vec3 uDiffuseLightColor;
 
 uniform float uRoughness;
 uniform float uMetallic;
 uniform float uSpecular;
 uniform float uAlpha;
 
 uniform vec3 uEmissionColor;
 uniform float uEmissionIntensity;
 
 float distributionGGX(vec3 N, vec3 H, float roughness) {
     float a = max(roughness * roughness, 0.001);
     float a2 = a * a;
     float NdotH = max(dot(N, H), 0.0);
     float NdotH2 = NdotH * NdotH;
     float denom = (NdotH2 * (a2 - 1.0) + 1.0);
     denom = 3.14159 * denom * denom;
     return a2 / denom;
 }
 
 vec3 fresnelSchlick(float cosTheta, vec3 F0) {
     return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
 }
 
 void main(void) {
     vec3 baseColor = uHasTexture ? texture2D(uTexture, vTextureCoord).rgb : uColor;
     
     // Get normal either from normal map or from vertex normal
     vec3 N;
     if (uHasNormalMap) {
         N = normalize(texture2D(uNormalMap, vTextureCoord).rgb * 2.0 - 1.0);
     } else {
         N = normalize(vNormal);
     }
     
     vec3 viewDir = normalize(vTangentViewDir);
 
     vec3 finalColor = uAmbientLightColor * baseColor;
 
     for (int i = 0; i < MAX_SPOT_LIGHTS; i++) {
         // Get the light direction in the appropriate space
         vec3 lightDir;
         vec3 worldNormal = normalize(vWorldNormal);
         vec3 worldLightDir = normalize(vWorldLightDir[i]);
         
         // Check if the light is on the same side as the normal
         // For non-normal mapped lighting, we need to check if the light and normal are facing the same way
         float facingLight = dot(worldNormal, worldLightDir);
         
         // Skip this light if it's on the wrong side of the surface
         if (!uHasNormalMap && facingLight <= 0.0) {
             continue;
         }
         
         // Use tangent space calculations if we have a normal map, otherwise use world space
         if (uHasNormalMap) {
             lightDir = normalize(vTangentLightDir[i]);
         } else {
             lightDir = worldLightDir;
         }
         
         vec3 H = normalize(viewDir + lightDir);
 
         // Spotlight cone check
         vec3 spotDir = normalize(-uSpotLightDirection[i]);
         float spotEffect = dot(normalize(uSpotLightPosition[i] - vWorldPos), spotDir);
         float outerCutOff = cos(uSpotLightAngle[i]);
         float innerCutOff = cos(uSpotLightAngle[i] - radians(5.0));
         float spotFactor = smoothstep(outerCutOff, innerCutOff, spotEffect);
         float softEdgeFactor = pow(spotFactor, 2.0);
 
         // Only apply light if within the spotlight cone
         if (spotEffect > outerCutOff) {
             float NdotL = max(dot(N, lightDir), 0.0);
             float NdotV = max(dot(N, viewDir), 0.0);
             float NdotH = max(dot(N, H), 0.0);
 
             // Specular GGX
             float D = distributionGGX(N, H, uRoughness);
             vec3 F0 = mix(vec3(0.04), baseColor, uMetallic);
             vec3 F = fresnelSchlick(NdotH, F0);
             float denom = 4.0 * max(NdotL * NdotV, 0.001);
             vec3 specularColor = D * F * NdotL * uSpecularLightColor * uSpecular / denom;
 
             // Diffuse
             vec3 diffuseColor = uDiffuseLightColor * uSpotLightColor[i] * NdotL * (1.0 - uMetallic);
 
             finalColor += softEdgeFactor * uSpotLightIntensity[i] * (diffuseColor + specularColor);
         }
     }
 
     finalColor += uEmissionColor * uEmissionIntensity;
 
     gl_FragColor = vec4(finalColor * baseColor, uAlpha);
     }`;
export const DirLightvsSource: WebGLShader = `
    #define MAX_DIR_LIGHTS 10

    attribute vec4 aPosition;
    attribute vec3 aVertexNormal;
    attribute vec4 aVertexColor;
    attribute vec2 aTextureCoord;
    attribute vec3 aTangent;

    uniform mat4 u_modelMatrix;
    uniform mat4 u_viewMatrix;
    uniform mat4 u_projectionMatrix;

    uniform vec3 uLightDirection[MAX_DIR_LIGHTS]; 

    varying lowp vec4 vColor;
    varying vec3 vNormal;
    varying vec4 vPosition;
    varying vec2 vTextureCoord;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    varying vec3 vViewPosition;
    varying vec3 vWorldLightDir[MAX_DIR_LIGHTS];

    void main() {
        vec4 worldPosition = u_modelMatrix * vec4(aPosition.xyz, 1.0);
        vPosition = worldPosition;
        gl_Position = u_projectionMatrix * u_viewMatrix * worldPosition;

        // Transform normal and tangent to world space
        vNormal = normalize(mat3(u_modelMatrix) * aVertexNormal);
        vTangent = normalize(mat3(u_modelMatrix) * aTangent);
        // Calculate bitangent in world space
        vBitangent = normalize(cross(vNormal, vTangent));

        vTextureCoord = aTextureCoord;
        vColor = aVertexColor;

        // Pass view position for lighting calculations
        // Correct world-space camera position extraction
        vec3 viewPos = vec3(
        -(u_viewMatrix[3][0] * u_viewMatrix[0][0] + 
          u_viewMatrix[3][1] * u_viewMatrix[0][1] + 
          u_viewMatrix[3][2] * u_viewMatrix[0][2]), 

        -(u_viewMatrix[3][0] * u_viewMatrix[1][0] + 
          u_viewMatrix[3][1] * u_viewMatrix[1][1] + 
          u_viewMatrix[3][2] * u_viewMatrix[1][2]), 

        -(u_viewMatrix[3][0] * u_viewMatrix[2][0] + 
          u_viewMatrix[3][1] * u_viewMatrix[2][1] + 
          u_viewMatrix[3][2] * u_viewMatrix[2][2])
         );

         vViewPosition = viewPos;

        // Pass light directions to fragment shader (already in correct format)
        for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
            vWorldLightDir[i] = normalize(uLightDirection[i]);
        }
    }`;
export const DirLightfsSource: WebGLShader = `
    precision highp float;
    #define MAX_DIR_LIGHTS 10
    #define PI 3.14159265359
    
    varying vec3 vNormal;
    varying vec4 vPosition;
    varying highp vec2 vTextureCoord;
    varying vec3 vTangent;
    varying vec3 vBitangent;
    varying vec3 vViewPosition;
    varying vec3 vWorldLightDir[MAX_DIR_LIGHTS];
    
    uniform sampler2D uSampler;
    uniform sampler2D uNormalMap;
    uniform bool uHasTexture;
    uniform bool uHasNormalMap;
    
    uniform float uDirectionalLightIntensity[MAX_DIR_LIGHTS];
    uniform vec3 uDirectionalLightColor[MAX_DIR_LIGHTS];
    
    uniform vec3 uColor;
    uniform vec3 uAmbientLightColor;
    uniform vec3 uSpecularLightColor;
    uniform vec3 uDiffuseLightColor;
    
    uniform float uRoughness;
    uniform float uMetallic;
    uniform float uSpecular;
    uniform float uAlpha;
    
    uniform vec3 uEmissionColor;
    uniform float uEmissionIntensity;
    
    // PBR functions (unchanged)
    float DistributionGGX(vec3 N, vec3 H, float roughness) {
        float a = roughness * roughness;
        float a2 = a * a;
        float NdotH = max(dot(N, H), 0.0);
        float NdotH2 = NdotH * NdotH;
        
        float denom = (NdotH2 * (a2 - 1.0) + 1.0);
        denom = PI * denom * denom;
        
        return a2 / max(denom, 0.0001);
    }
    float GeometrySchlickGGX(float NdotV, float roughness) {
        float r = (roughness + 1.0);
        float k = (r * r) / 8.0;
        
        float denom = NdotV * (1.0 - k) + k;
        return NdotV / max(denom, 0.0001);
    }
    
    float GeometrySmith(vec3 N, vec3 V, vec3 L, float roughness) {
        float NdotV = max(dot(N, V), 0.0);
        float NdotL = max(dot(N, L), 0.0);
        float ggx1 = GeometrySchlickGGX(NdotV, roughness);
        float ggx2 = GeometrySchlickGGX(NdotL, roughness);
        
        return ggx1 * ggx2;
    }
    
    vec3 FresnelSchlick(float cosTheta, vec3 F0) {
        return F0 + (1.0 - F0) * pow(1.0 - cosTheta, 5.0);
    }
    
    void main(void) {
        // Sample textures
        vec4 texColor = uHasTexture ? texture2D(uSampler, vTextureCoord) : vec4(uColor, 1.0);
        float alpha = texColor.a * uAlpha;
        
        // Create TBN matrix
        vec3 T = normalize(vTangent);
        vec3 B = normalize(vBitangent);
        vec3 N = normalize(vNormal);
        mat3 TBN = mat3(T, B, N);
        
        // Get normal from normal map and transform it to world space
        if (uHasNormalMap) {
            vec3 normalMap = texture2D(uNormalMap, vTextureCoord).rgb;
            normalMap = normalMap * 2.0 - 1.0;
            N = normalize(TBN * normalMap);
        }
        
        // Calculate view direction (from fragment to camera)
        vec3 V = normalize(vViewPosition - vPosition.xyz);
        
        // Base reflectivity
        vec3 F0 = vec3(0.04);
        F0 = mix(F0, texColor.rgb, uMetallic);
        
        // Initialize lighting with ambient and emission
        vec3 Lo = vec3(0.0);
        vec3 ambient = uAmbientLightColor * texColor.rgb;
        vec3 emission = uEmissionColor * uEmissionIntensity;
        
        // Calculate lighting for each light
        for (int i = 0; i < MAX_DIR_LIGHTS; i++) {
            // Use the light direction as-is (no negation)
            vec3 L = normalize(vWorldLightDir[i]);
            vec3 H = normalize(V + L);
            
            // Calculate all lighting terms
            float NdotL = max(dot(N, L), 0.0);
            
            // Skip if fragment is not lit by this light
            if (NdotL > 0.0) {
                // Cook-Torrance BRDF
                float NDF = DistributionGGX(N, H, uRoughness);
                float G = GeometrySmith(N, V, L, uRoughness);
                vec3 F = FresnelSchlick(max(dot(H, V), 1.0), F0);
                
                // Calculate specular term
                vec3 numerator = NDF * G * F;
                float denominator = 4.0 * max(dot(N, V), 0.0) * NdotL + 0.0001;
                vec3 specular = numerator / denominator;
                
                // Energy conservation
                vec3 kD = (vec3(1.0) - F) * (1.0 - uMetallic);
    
                
                // Calculate light contribution
                float lightIntensity = uDirectionalLightIntensity[i];
                vec3 lightColor = uDirectionalLightColor[i];
                
                vec3 diffuse = kD * texColor.rgb / PI;
                
                // Combine diffuse and specular with light intensity and color
                Lo += (diffuse + specular * uSpecular) * lightColor * lightIntensity * NdotL;
            }
        }
        
        // Combine all lighting components
        vec3 finalColor = Lo + ambient + emission;
        
        // Tone mapping (simple exposure)
        finalColor = vec3(1.0) - exp(-finalColor * 1.0);
        
        // Gamma correction
        finalColor = pow(finalColor, vec3(1.0/2.2));
        
        gl_FragColor = vec4(finalColor, alpha);
    }`;
